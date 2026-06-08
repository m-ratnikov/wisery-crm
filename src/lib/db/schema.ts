import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// Ingestion spine (signal-ingestion). Schema conventions decided here propagate to
// every later table because Drizzle migrations are immutable (design D-A..D-G):
// uuid PKs via gen_random_uuid(), timestamptz, JSONB only at the connector boundary,
// typed columns for anything queried, FKs NOT NULL + RESTRICT, retire via `enabled`.

// Shared column builders (rule of three): `created_at` is on every table, and the
// `created_at` + `updated_at` pair recurs on sources, rubric, and user_profile. These
// are functions so each table gets fresh builders rather than sharing mutable state.
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const timestamps = () => ({
  createdAt: createdAt(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

// Provider / prompt-version / model provenance for an LLM-produced row (scorings, drafts, comments),
// recorded so outcomes can be evaluated per provider+model and per prompt version (D7, ADR-0003).
const llmCols = () => ({
  provider: text("provider").notNull(),
  promptVersion: text("prompt_version").notNull(),
  model: text("model").notNull(),
});

// Closed domain vocabularies -> pg enums (D-F). Growth is an additive ALTER TYPE.
export const scanStatus = pgEnum("scan_status", ["running", "completed", "failed"]);
// person | company | content | job. Grows by an additive ALTER TYPE ADD VALUE applied in
// isolation (never ADD-then-USE in one migration). A non-person kind is persisted but routed
// past qualify (which scores a person) until normalize-expand lands - the routing is at the
// composition root, by kind (linkedin-jobs-source).
export const signalKind = pgEnum("signal_kind", ["person", "company", "content", "job"]);
// A draft's state among a prospect's drafts: one `selected` candidate, prior ones
// `archived` (drafts are regenerable, ADR-0007). Closed, low-churn -> a pg enum.
export const draftStatus = pgEnum("draft_status", ["generated", "selected", "archived"]);
// The result of a human-sent touch (review-queue). Closed, low-churn -> a pg enum.
export const outcomeResult = pgEnum("outcome_result", [
  "connected",
  "replied",
  "booked",
  "no_response",
]);

// A configured origin, config-as-data. `kind` is text (not an enum) because it grows
// with every adapter (D8, D-F); connector-shaped data is JSONB (D-E).
export const sources = pgTable("sources", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  kind: text("kind").notNull(),
  config: jsonb("config").$type<Record<string, unknown>>().notNull(),
  cursor: jsonb("cursor").$type<Record<string, unknown>>(),
  schedule: text("schedule"),
  enabled: boolean("enabled").notNull().default(true),
  ...timestamps(),
});

// One isolated run record per scan, with per-stage counts and outcome (D-D).
export const scans = pgTable(
  "scans",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => sources.id, { onDelete: "restrict" }),
    status: scanStatus("status").notNull().default("running"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    fetchedCount: integer("fetched_count").notNull().default(0),
    persistedCount: integer("persisted_count").notNull().default(0),
    droppedCount: integer("dropped_count").notNull().default(0),
    error: text("error"),
    createdAt: createdAt(),
  },
  (t) => [index("scans_source_idx").on(t.sourceId)],
);

// A deduped, append-only fact: immutable, no updated_at, no status column (D-C).
// Pipeline progress lives in the durable queue, not on this hot table.
export const signals = pgTable(
  "signals",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => sources.id, { onDelete: "restrict" }),
    scanId: uuid("scan_id")
      .notNull()
      .references(() => scans.id, { onDelete: "restrict" }),
    kind: signalKind("kind").notNull(),
    dedupKey: text("dedup_key").notNull(),
    payload: jsonb("payload").$type<unknown>().notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    // Per-source idempotency (D-B); doubles as the dedup-lookup index.
    uniqueIndex("signals_source_dedup_uq").on(t.sourceId, t.dedupKey),
    index("signals_source_idx").on(t.sourceId),
    index("signals_scan_idx").on(t.scanId),
  ],
);

// ICP config-as-data (icp-config). The rubric the qualifier scores against and the user
// profile the drafter writes from, kept as data the engine reads, never hardcoded (D6,
// D1). Edits are additive new versions, never updates in place, so a past Scoring's
// rubric is never rewritten (the learning-loop invariant - domain-model). Criteria and
// profile are JSONB validated by Zod at the app boundary (src/lib/icp); version/active
// are typed columns.
export const rubric = pgTable(
  "rubric",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    name: text("name").notNull(),
    // The intent a rubric scores for: icp (buyer fit) | peer (amplifier fit) | company
    // (firmographic fit), default icp (ADR-0017). text+Zod (the churn-prone-set policy).
    kind: text("kind").notNull().default("icp"),
    rubric: jsonb("rubric").$type<unknown>().notNull(),
    version: integer("version").notNull(),
    active: boolean("active").notNull().default(false),
    ...timestamps(),
  },
  (t) => [
    // At most one active rubric per kind: a partial unique index over the active rows by
    // kind (ADR-0017, generalizing the prior single-active constraint). D-B.
    uniqueIndex("rubric_one_active_uq")
      .on(t.kind)
      .where(sql`${t.active}`),
  ],
);

export const userProfile = pgTable("user_profile", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  profile: jsonb("profile").$type<unknown>().notNull(),
  version: integer("version").notNull(),
  ...timestamps(),
});

// Configurable pipelines (ADR-0020): an operator-owned ordered set of statuses, config-as-data
// (a peer of Rubric and User Profile), seeded from code then CRUD-able. A Person's pipeline
// position is a FK into `pipeline_status`, not a fixed enum, so the columns the operator works
// in are data, not a migration. `slug` is the stable handle the seed/backfill key on; one default
// pipeline newly created People enter at.
export const pipeline = pgTable("pipeline", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  isDefault: boolean("is_default").notNull().default(false),
  ...timestamps(),
});

// One ordered column in a pipeline. `position` orders the columns (unique within a pipeline). The
// (pipeline_id, id) unique index is the composite-FK target Person points at, so the DB - not an
// app check - guarantees a Person's status always belongs to its own pipeline (ADR-0020).
export const pipelineStatus = pgTable(
  "pipeline_status",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    pipelineId: uuid("pipeline_id")
      .notNull()
      .references(() => pipeline.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    position: integer("position").notNull(),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("pipeline_status_pipeline_id_uq").on(t.pipelineId, t.id),
    uniqueIndex("pipeline_status_position_uq").on(t.pipelineId, t.position),
  ],
);

// Qualification (qualification). A Prospect is a person under evaluation, fanned out from a
// Signal (one-to-many, ADR-0005); its pipeline progress lives in `pipeline_id` + `status_id`, a
// FK into a configurable pipeline (ADR-0020), not a fixed enum. A Scoring is the per-person ICP
// rating against a rubric version -
// additive, so re-scoring is new rows and the learning loop binds outcomes to the exact
// score and rubric a prospect was acted on (D5, D7).
// A Prospect originates from a signal (discovered, the fan-out path) or is entered manually
// by the CRM user (ADR-0010). `origin` is text+Zod (the churn-prone-set policy, beside
// `status`), defaulting to `signal` so the migration is additive. `signal_id` is nullable:
// set iff origin = signal, NULL iff origin = manual. A manual prospect's person identity lives
// in its own columns (name/headline/company/linkedin_url); a signal-derived one reads identity
// from signals.payload, both via the PersonSubject seam (src/lib/prospect/identity). The
// per-origin CHECK makes "signal-derived but missing its signal" unrepresentable and admits a
// future origin without tripping (ADR-0010).
export const person = pgTable(
  "person",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    // Why a person is tracked: prospect (outreach/ICP target) | peer (amplifier engaged via
    // comments), default prospect (ADR-0015). `monitored` flags a person whose posts are
    // watched in the Feed, independent of `type`. Additive defaults so every existing row reads
    // as a non-monitored prospect with no backfill.
    type: text("type").notNull().default("prospect"),
    monitored: boolean("monitored").notNull().default(false),
    origin: text("origin").notNull().default("signal"),
    signalId: uuid("signal_id").references(() => signals.id, { onDelete: "restrict" }),
    // Nullable link to a Company (ADR-0016); the company-to-people expansion job that populates
    // it is deferred, so it is mostly null until that lands.
    companyId: uuid("company_id").references(() => companies.id, { onDelete: "restrict" }),
    name: text("name"),
    headline: text("headline"),
    company: text("company"),
    linkedinUrl: text("linkedin_url"),
    // The Person's pipeline position (ADR-0020): a FK into pipeline_status, not a fixed enum. The
    // composite FK below pins (pipeline_id, status_id) to a pipeline_status's (pipeline_id, id), so
    // a Person can never point at a status of another pipeline. Qualification is NOT here - it is a
    // read over the latest icp Scoring (ADR-0019). The old text `status` enum was retired in the
    // additive-then-swap migration sequence (ADR-0020).
    pipelineId: uuid("pipeline_id")
      .notNull()
      .references(() => pipeline.id, { onDelete: "restrict" }),
    statusId: uuid("status_id").notNull(),
    ...timestamps(),
  },
  (t) => [
    index("person_signal_idx").on(t.signalId),
    index("person_company_idx").on(t.companyId),
    check(
      "person_origin_chk",
      sql`(${t.origin} <> 'signal' OR ${t.signalId} IS NOT NULL) AND (${t.origin} <> 'manual' OR (${t.signalId} IS NULL AND ${t.name} IS NOT NULL))`,
    ),
    foreignKey({
      columns: [t.pipelineId, t.statusId],
      foreignColumns: [pipelineStatus.pipelineId, pipelineStatus.id],
      name: "person_pipeline_status_fk",
    }).onDelete("restrict"),
  ],
);

// A first-class company (ADR-0016), created when a company signal is approved at triage. Carries
// firmographic identity; `signal_id` is nullable (left null for any future manual entry). The
// company-to-people expansion job (populating person.company_id) is deferred.
export const companies = pgTable("companies", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  signalId: uuid("signal_id").references(() => signals.id, { onDelete: "restrict" }),
  name: text("name").notNull(),
  domain: text("domain"),
  linkedinUrl: text("linkedin_url"),
  firmographics: jsonb("firmographics").$type<unknown>(),
  ...timestamps(),
});

// The human triage verdict on a signal (ADR-0014). Separate from the immutable signal so the
// scanner (which re-encounters the same deduped signal every run) can never reset a decision:
// one decision per signal (unique signal_id), `pending` = the absence of a row. `created_entity_id`
// is a convenience denormalization of the single primary entity an approval produced - the
// authoritative link is the reverse FK (person.signal_id / companies.signal_id) - so it is a
// plain nullable uuid, not an FK, and is null for a dismissal.
// A required, unique FK to a signal - one row per signal, shared by signal_decisions and
// signal_advisory. The inner arrow resolves `signals` lazily at FK-resolution time.
const signalRef = () =>
  uuid("signal_id")
    .notNull()
    .unique()
    .references(() => signals.id, { onDelete: "restrict" });

export const signalDecisions = pgTable("signal_decisions", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  signalId: signalRef(),
  disposition: text("disposition").notNull(),
  createdEntityId: uuid("created_entity_id"),
  decidedAt: timestamp("decided_at", { withTimezone: true }).notNull().defaultNow(),
});

// The advisory triage hint for a pending signal (universal-triage, ADR-0013/0017): the
// advisory-filter job scores each signal against the rubric matching its intent and writes the
// result here so the triage lane shows it without a per-load LLM call. NOT a durable Scoring (no
// learning-loop binding) - `score` is null when no rubric of that intent kind is active. One per
// signal (unique), refreshed by the job.
export const signalAdvisory = pgTable("signal_advisory", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  signalId: signalRef(),
  rubricKind: text("rubric_kind").notNull(),
  score: smallint("score"),
  reason: text("reason"),
  createdAt: createdAt(),
});

export const scorings = pgTable(
  "scorings",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    personId: uuid("person_id")
      .notNull()
      .references(() => person.id, { onDelete: "restrict" }),
    rubricId: uuid("rubric_id")
      .notNull()
      .references(() => rubric.id, { onDelete: "restrict" }),
    score: smallint("score").notNull(), // 1-5, or -1 for insufficient data
    reason: text("reason"),
    summary: text("summary"),
    // How this score was produced (ADR-0019): `llm` = a real scorer call; `advisory` = the
    // cheap triage advisory score promoted at approval (no LLM). The learning loop (D7) excludes
    // `advisory` rows so the cheap pass never tunes the bar (ADR-0017 purpose preserved).
    provenance: text("provenance").notNull().default("llm"),
    // The LLM provider + model + prompt version that produced this score, so outcomes can
    // be evaluated per provider+model and per prompt version over time (D7, ADR-0003). For an
    // `advisory`-provenance row these carry the `advisory` sentinel (no real LLM call).
    ...llmCols(),
    scoredAt: timestamp("scored_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("scorings_person_idx").on(t.personId), index("scorings_rubric_idx").on(t.rubricId)],
);

// A personalized first-touch message for a prospect (drafting). Drafts are regenerable -
// one `selected` per prospect, prior ones `archived` (ADR-0007); "drafted" is derived from
// this relation, not a prospect status (ADR-0008). Records provider/prompt/model for evals.
export const drafts = pgTable(
  "drafts",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    personId: uuid("person_id")
      .notNull()
      .references(() => person.id, { onDelete: "restrict" }),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => userProfile.id, { onDelete: "restrict" }),
    channel: text("channel").notNull().default("linkedin"),
    body: text("body").notNull(),
    status: draftStatus("status").notNull().default("selected"),
    ...llmCols(),
    createdAt: createdAt(),
  },
  (t) => [
    index("drafts_person_idx").on(t.personId),
    // At most one `selected` draft per prospect (the one-active pattern, like rubric):
    // makes the regenerate/re-draft race fail at the DB, not just rely on the singleton
    // job queue (drafting D-C). Archived/generated drafts are unconstrained.
    uniqueIndex("drafts_one_selected_uq")
      .on(t.personId)
      .where(sql`${t.status} = 'selected'`),
  ],
);

// The deep-enrichment research bundle for a prospect (enrichment). One per prospect (a
// re-enrich upserts), stored as opaque JSONB - the system does not interpret its shape
// (D4/ADR-0002, D-B). "Enriched" is derived from this relation, not a status (ADR-0008).
export const dossiers = pgTable(
  "dossiers",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    personId: uuid("person_id")
      .notNull()
      .references(() => person.id, { onDelete: "restrict" }),
    data: jsonb("data").$type<unknown>().notNull(),
    provider: text("provider").notNull(),
    enrichedAt: timestamp("enriched_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("dossiers_person_uq").on(t.personId)],
);

// Per-tenant app settings, config-as-data (D1). Single row for single-tenant MVP; holds
// the opt-in auto-enrich flag (ADR-0007). `tenant_id` is the additive productization hook.
export const settings = pgTable("settings", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  autoEnrich: boolean("auto_enrich").notNull().default(false),
  ...timestamps(),
});

// A logged result of a human-sent touch (review-queue). `score_at_time` binds the outcome
// to the score the prospect was acted on, so the precision bar is tunable later without a
// migration (D7). `draft_id` is nullable (a touch may use no generated draft).
export const outcomes = pgTable(
  "outcomes",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    personId: uuid("person_id")
      .notNull()
      .references(() => person.id, { onDelete: "restrict" }),
    draftId: uuid("draft_id").references(() => drafts.id, { onDelete: "restrict" }),
    scoreAtTime: smallint("score_at_time").notNull(),
    result: outcomeResult("result").notNull(),
    channel: text("channel").notNull(),
    notes: text("notes"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: createdAt(),
  },
  (t) => [index("outcomes_person_idx").on(t.personId)],
);

// A piece of a person's content (engagement-posts, ADR-0018), attached to a Person. Created on
// demand ("get latest posts") or by the activity scan over monitored people; usually independent
// of any signal. `dedup_key` (the provider's stable post id, else a canonicalized permalink) is
// unique per person, so re-fetch and the scan upsert idempotently - the same discipline as
// signals' per-source dedup.
export const posts = pgTable(
  "posts",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    personId: uuid("person_id")
      .notNull()
      .references(() => person.id, { onDelete: "restrict" }),
    externalUrl: text("external_url").notNull(),
    dedupKey: text("dedup_key").notNull(),
    content: text("content").notNull(),
    postedAt: timestamp("posted_at", { withTimezone: true }),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("posts_person_dedup_uq").on(t.personId, t.dedupKey),
    index("posts_person_idx").on(t.personId),
  ],
);

// An AI-drafted reply to a Post (engagement-comments, ADR-0018), human-posted (D2). A SEPARATE
// table from drafts because the business rule differs (per-post, many-per-person vs per-person,
// one-selected). `person_id` is denormalized from the post so the person-360 read does not walk
// posts. `status` is text+Zod (generated | posted | dismissed); records provider/prompt/model for
// evals like a draft. Each generate/regenerate writes a NEW row (no one-selected constraint).
export const comments = pgTable(
  "comments",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "restrict" }),
    personId: uuid("person_id")
      .notNull()
      .references(() => person.id, { onDelete: "restrict" }),
    body: text("body").notNull(),
    status: text("status").notNull().default("generated"),
    ...llmCols(),
    createdAt: createdAt(),
  },
  (t) => [index("comments_post_idx").on(t.postId), index("comments_person_idx").on(t.personId)],
);

// The global comment guidance (engagement-comments, ADR-0018): tone and rules for comment
// generation, config-as-data (a peer of Rubric and User Profile). Edits are additive new versions;
// a single active row (partial unique index over the active rows).
export const commentGuidance = pgTable(
  "comment_guidance",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    active: boolean("active").notNull().default(false),
    guidance: jsonb("guidance").$type<unknown>().notNull(),
    version: integer("version").notNull(),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("comment_guidance_one_active_uq")
      .on(t.active)
      .where(sql`${t.active}`),
  ],
);
