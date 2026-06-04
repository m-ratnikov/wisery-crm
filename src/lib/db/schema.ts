import { sql } from "drizzle-orm";
import {
  boolean,
  check,
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
    rubric: jsonb("rubric").$type<unknown>().notNull(),
    version: integer("version").notNull(),
    active: boolean("active").notNull().default(false),
    ...timestamps(),
  },
  (t) => [
    // At most one active rubric: a partial unique index over the active rows (D-B).
    uniqueIndex("rubric_one_active_uq")
      .on(t.active)
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

// Qualification (qualification). A Prospect is a person under evaluation, fanned out from a
// Signal (one-to-many, ADR-0005); its pipeline progress lives in `status` (text + Zod, the
// most churn-prone set). A Scoring is the per-person ICP rating against a rubric version -
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
export const prospects = pgTable(
  "prospects",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    origin: text("origin").notNull().default("signal"),
    signalId: uuid("signal_id").references(() => signals.id, { onDelete: "restrict" }),
    name: text("name"),
    headline: text("headline"),
    company: text("company"),
    linkedinUrl: text("linkedin_url"),
    status: text("status").notNull(),
    ...timestamps(),
  },
  (t) => [
    index("prospects_signal_idx").on(t.signalId),
    check(
      "prospects_origin_chk",
      sql`(${t.origin} <> 'signal' OR ${t.signalId} IS NOT NULL) AND (${t.origin} <> 'manual' OR (${t.signalId} IS NULL AND ${t.name} IS NOT NULL))`,
    ),
  ],
);

export const scorings = pgTable(
  "scorings",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    prospectId: uuid("prospect_id")
      .notNull()
      .references(() => prospects.id, { onDelete: "restrict" }),
    rubricId: uuid("rubric_id")
      .notNull()
      .references(() => rubric.id, { onDelete: "restrict" }),
    score: smallint("score").notNull(), // 1-5, or -1 for insufficient data
    reason: text("reason"),
    summary: text("summary"),
    // The LLM provider + model + prompt version that produced this score, so outcomes can
    // be evaluated per provider+model and per prompt version over time (D7, ADR-0003).
    provider: text("provider").notNull(),
    promptVersion: text("prompt_version").notNull(),
    model: text("model").notNull(),
    scoredAt: timestamp("scored_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("scorings_prospect_idx").on(t.prospectId),
    index("scorings_rubric_idx").on(t.rubricId),
  ],
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
    prospectId: uuid("prospect_id")
      .notNull()
      .references(() => prospects.id, { onDelete: "restrict" }),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => userProfile.id, { onDelete: "restrict" }),
    channel: text("channel").notNull().default("linkedin"),
    body: text("body").notNull(),
    status: draftStatus("status").notNull().default("selected"),
    provider: text("provider").notNull(),
    promptVersion: text("prompt_version").notNull(),
    model: text("model").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index("drafts_prospect_idx").on(t.prospectId),
    // At most one `selected` draft per prospect (the one-active pattern, like rubric):
    // makes the regenerate/re-draft race fail at the DB, not just rely on the singleton
    // job queue (drafting D-C). Archived/generated drafts are unconstrained.
    uniqueIndex("drafts_one_selected_uq")
      .on(t.prospectId)
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
    prospectId: uuid("prospect_id")
      .notNull()
      .references(() => prospects.id, { onDelete: "restrict" }),
    data: jsonb("data").$type<unknown>().notNull(),
    provider: text("provider").notNull(),
    enrichedAt: timestamp("enriched_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("dossiers_prospect_uq").on(t.prospectId)],
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
    prospectId: uuid("prospect_id")
      .notNull()
      .references(() => prospects.id, { onDelete: "restrict" }),
    draftId: uuid("draft_id").references(() => drafts.id, { onDelete: "restrict" }),
    scoreAtTime: smallint("score_at_time").notNull(),
    result: outcomeResult("result").notNull(),
    channel: text("channel").notNull(),
    notes: text("notes"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: createdAt(),
  },
  (t) => [index("outcomes_prospect_idx").on(t.prospectId)],
);
