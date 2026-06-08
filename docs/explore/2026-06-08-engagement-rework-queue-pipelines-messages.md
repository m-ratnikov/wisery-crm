# Explore: Engagement rework - on-demand generation, the unified queue, configurable pipelines, per-channel messages

- Date: 2026-06-08
- Decision: to be distilled into new + superseding ADRs via the `engagement-rework` spec-driven-architecture change (pending). Supersedes ADR-0008; refines ADR-0005/0007/0013/0018; removes the drafting stage from system-design.
- Method: spec-kit (clarify + research), adapted
- Provenance: refines the model shipped by `2026-06-06-content-marketing-engagement.md` (ADR-0013..0018) after a design review with the product owner (this session).

## Question

The content-marketing change (ADR-0013..0018) shipped a separate Triage surface, kept drafting
as an auto pipeline stage feeding a Review & approve queue, and kept a fixed Person status enum.
On review the owner rejected that shape. How do we re-cut it so that: (1) message generation is an
on-demand action on the Person, not a pipeline stage; (2) there is one unified Queue (the signals
inbox), not a separate Triage surface; (3) Person status is a configurable pipeline (Breakcold
style), not a fixed enum - without bolting on parallel mechanisms?

## Assumptions and constraints

- Reuse before build (CLAUDE.md). Most of the data layer already fits this model and is REUSED, not
  rebuilt: `signal_advisory` (per-signal AI score by rubric kind) = the Queue's score + filter;
  `signal_decisions` (approve/dismiss -> `created_entity_id`, unique per signal) = the Queue's
  create-Person/Company + decided-drop-out; the synchronous comment generator (ADR-0018: a server
  action that writes a row per call, no pg-boss job) = the on-demand generation pattern; `posts` =
  the person's posts-history section; the `qualify` core (ADR-0005) = the on-demand re-score; the
  `enrich` core (ADR-0007) = on-demand enrich.
- D2 holds: automate the intelligence, the channel action stays human. No auto-send.
- Drizzle migrations are immutable once applied; new shape = new migration. A table/column rename
  needs a hand-authored `ALTER ... RENAME` + reconciled snapshot/journal (drizzle-kit needs a TTY).
- The verify-gate's ADR sign-off is a human gate the agent must not self-sign.

## Clarifications (Q&A from the clarify pass, this session)

- **Surface divergence found:** explore-note T3 (2026-06-06) chose ONE Queue surface (`kind ∈
  {triage, send}`, one nav item) and explicitly rejected separate surfaces; the implementation
  shipped separate `/triage` and `/review-queue` nav items. This rework corrects that - but in the
  owner's stronger form (the send/draft surface is removed entirely, not merged).
- **Q1 re-scoring on create:** No auto re-run of scoring when a Person is created from the Queue.
  Re-scoring is an **on-demand button** on the Person details page.
- **Q2 status/lifecycle:** Drop the fixed `queued/acted/closed` disposition enum. Replace with
  **configurable pipelines** (Breakcold-style kanban: ordered statuses as columns, people as cards).
  Seed one **default pipeline + statuses from code**, but statuses are dynamic/CRUD-able.
- **Q3 message model:** **Separate entities per message type.** A connection-request is a *type* of
  general **LinkedIn Message** (appears in message history); a **Comment** is a different thing,
  linked to a specific **Post** (kept as the existing ADR-0018 entity, unchanged - NOT converged
  into Message). Do not merge Comment and Message.
- **Q4 queue persistence:** Once decided, an item **drops from the Queue**. The Queue catches *fresh*
  people/companies; activity on *existing* prospects lives in the **Feed**. (Keep the hide-decided
  read: `signals LEFT JOIN signal_decisions WHERE disposition IS NULL`.)

## Unknowns

- **NC1 (deferred): channel discriminator vs separate table.** When other channels arrive (X, email,
  Telegram), messages/comments will likely reuse these tables with a `channel` field rather than new
  tables per channel - but discriminator-field vs per-channel-table is left to a later investigation.
  v1 ships LinkedIn-only: a `Message` table (LinkedIn) and the existing `Comment` table (LinkedIn).
- **NC2 (design-time): manual-lead scoring.** Manual lead entry (ADR-0010) today auto-enqueues
  qualify -> durable Scoring. Decide at design time whether manual leads keep auto-score or move to
  on-demand re-score like Queue-created people. Recommended: keep manual-lead auto-score (it is an
  explicit "I want this person scored" act), and make Queue-created people score-on-demand.

## Options considered

- **Drafting: auto stage vs on-demand action.** Chosen: on-demand. The drafter, the draft prompt,
  the `qualify -> draft` handoff, the `queued` status, and the Review & approve queue surface are
  removed; generation moves to the Person page using the synchronous-generation pattern that already
  exists for comments. Rejected: keep the stage (contradicts "generation is a Person feature, not a
  funnel position"; forces every qualified person through an LLM draft they may never want).
- **Status: fixed disposition enum vs configurable pipeline.** Chosen: configurable pipeline
  (supersedes ADR-0008). Rejected: keep the fixed enum (cannot express the owner's kanban workflow;
  the CRM's whole point is a configurable sales pipeline).
- **Intake: one Queue vs Queue + Triage.** Chosen: one Queue (the Queue *is* the triage; create
  buttons per item; decided items drop out; score filter). Rejected: separate Triage surface (the
  over-fragmentation the original T3 already rejected).
- **Messages: one GeneratedMessage table vs per-type entities.** Chosen: per-type entities (Message
  for LinkedIn DMs incl. CR-as-type; Comment kept separate, post-linked). Rejected: a single unified
  message table (loses the Comment-is-post-context distinction the owner wants to keep).

## Key findings (grounded in the current system)

- The Queue read already does the right thing: `src/lib/triage/read.ts` is a LEFT JOIN that
  hides decided signals and surfaces the advisory hint. It becomes the Queue verbatim plus a score
  filter. The anti-strand invariant (LEFT JOIN, not INNER) must be preserved (system-review record
  2026-06-07).
- Approval routing already exists: `src/lib/triage/decide.ts` `approveSignal` creates
  Person(prospect)/Company/Person(peer)+Post by kind in one tx. The only change is it stops
  enqueuing `qualify` (no auto-score on create) and instead copies the signal's advisory score
  forward as the person's initial score (free, no LLM call).
- The synchronous generator is the template: `src/lib/comments/generate.ts` is a server action
  writing one row per call - the Message generator is the same shape with a versioned LI prompt.
- `Person.status` is a `text` column today validated by `prospectStatusSchema`
  (`src/lib/qualify/status.ts`). Configurable pipelines turn it into a FK to a seeded, CRUD-able
  `pipeline_status`, so that Zod enum is retired in favor of a DB-backed vocabulary.

## Outcome

The consolidated model:

- **Queue** = the sole intake. Fresh undecided signals of every kind, AI-scored by their kind's
  rubric, filterable by score; per-item "Create Person"/"Create Company"; decided items drop out.
- **Feed** = activity of existing prospects (posts/events). Unchanged in spirit.
- **Person details page** = the workspace: general/PII, posts history, message history, on-demand
  actions (generate message-by-type, generate comment-on-post, re-score, enrich). Status sits in a
  configurable pipeline.
- **Message** (LinkedIn; CR is a type) and **Comment** (post-linked) are separate entities, both
  generated on demand. `channel` discriminator deferred (NC1).
- **Configurable pipelines** replace the fixed status enum (supersedes ADR-0008): seed one default
  pipeline; statuses are CRUD-able.
- **Removed:** the drafting stage (worker, prompt, handoff), the `queued` status, the Review &
  approve queue, the separate `/triage` route.

Distilled to ADRs by the slicing below. Accepted defaults (owner did not veto): copy the advisory
score forward on create (no LLM); enrichment becomes on-demand from the Person page; pipelines scope
to People only in v1 (Companies/Deals later).

---

## Autonomous implementation plan

Goal: implement the whole rework with **one human interaction** (a single ADR sign-off) and
otherwise autonomous execution. The plan front-loads every design decision (above) so the build
needs no further clarification; the agent presents any genuinely-ambiguous edge-case decisions in a
batch *after* finishing (the pattern used on the content-marketing build).

### Phase 1 - Architecture (ONE change, ONE sign-off)

Bundle every ADR into a single `engagement-rework` spec-driven-architecture change (as the
content-marketing change bundled six), so the verify-gate runs once and the owner signs off once.

1. `/opsx:propose engagement-rework` (architecture schema). ADRs to author:
   - **NEW** "Generation is an on-demand Person action, not a pipeline stage" - removes the drafting
     stage; records the synchronous-generation principle for Message + Comment.
   - **NEW** "Configurable pipelines for Person status" - **Supersedes ADR-0008**. Pipelines +
     ordered statuses, seeded default, CRUD-able; `Person.status` -> FK.
   - **NEW** "LinkedIn Message entity (connection-request as a message type)" - the Message table;
     records NC1 (channel discriminator deferred) explicitly.
   - **REFINE** ADR-0013 (Queue is the sole intake; approval no longer auto-enqueues qualify; advisory
     score copied forward), ADR-0005 (durable Scoring is on-demand, not auto), ADR-0007 (enrichment
     on-demand from the Person page), ADR-0018 (Comment unchanged; Message added as a sibling).
   - Update `domain-model.md` + `system-design.md` (remove the drafting stage; the Queue/Feed/Person
     workspace surfaces; pipelines).
2. Run the **verify-gate** (agent: Stage 1 ledger, Stage 2 panel atlas/greybeard/pedant/canon, Stage
   3 chair). Rework to green per the gate.
3. **HUMAN GATE (the only one): ADR sign-off.** The agent must not self-sign.
4. `/opsx:apply engagement-rework` (promote ADRs to canon, strip `v:` anchors, merge views) ->
   `/opsx:archive`.

### Phase 2 - Code (three sequential changes, fully autonomous)

Each slice: `/opsx:propose` (code schema) -> `/opsx:apply` -> **`npm run verify` loop** ->
**`code-review` loop** (re-verify + re-review the fix delta in full context) -> `/opsx:archive`.
Move to the next slice only after the previous is green + archived. Run `system-review` at
convergence after Slice 3 (or after each, owner's call).

- **Slice 1 - Kill the drafting stage + unify the Queue.** (Mostly deletion; lands fast, de-risks
  the rest.) Remove `src/lib/draft/*`, the draft prompt, the `qualify -> draft` handoff in
  `bootstrap.ts`, the `queued` status, `src/app/(app)/review-queue/*`, and fold `/triage` into a new
  `/queue` (the sole intake) with a score filter + "Create Person/Company" labels. `approveSignal`
  stops enqueuing qualify and copies the advisory score forward. Keep the `qualify-prospect` worker
  alive (manual leads, NC2).
- **Slice 2 - Configurable pipelines.** Migrations for `pipeline` + `pipeline_status` (additive),
  seed a default pipeline + statuses from code, migrate `Person.status` -> FK (additive column then
  backfill then swap; data-preserving), supersede ADR-0008's enum. Minimal UI: a status setter on the
  Person list/detail; kanban board is a follow-up.
- **Slice 3 - Person workspace + Messages.** Person details sections (general/PII, posts history via
  the existing `listPostsForPerson`, message history); the `Message` table + a synchronous LI message
  generator (CR as a type) + versioned prompt(s); on-demand actions (generate message, generate
  comment [exists], re-score [qualify core], enrich [enrich core]).

Dependency order is 1 -> 2 -> 3.

### Guardrails (carry into every step)

- Review agents are READ-ONLY; never run `drizzle-kit`/a migration/any mutation from a reviewer (a
  reviewer once corrupted the migration journal). Generators/migrations are run by the implementer
  only.
- Migrations immutable; a rename is hand-authored `ALTER ... RENAME` + reconciled
  snapshot/journal (no TTY). Prefer additive-then-swap over rename for the `Person.status` FK change.
- `npm run verify` must be green and its exit code unmasked (run direct/background, never piped to
  `tail`). Gates: typecheck, lint, format, dependency-cruiser boundaries, jscpd **0%** (extract a
  helper at the third occurrence), per-file **75%** coverage (coverage-exclude `*-queue.ts`, network
  adapters, `src/app/**`, `schema.ts`), build.
- LLM via the `LLMProvider` port using Structured Outputs (never `tool_use`); prompts versioned in
  `src/prompts/<name>_v<n>.ts`. `server-only` on anything that must not reach the client bundle; RSC
  by default. No em-dashes; comment WHY not WHAT.
- The Queue read MUST stay a LEFT JOIN on `signal_advisory`/`signal_decisions` (anti-strand). Triage
  approval stays one tx; the `signal_decisions.signal_id` UNIQUE handles concurrent double-approve.
- Present batched edge-case decisions to the owner after each phase, not mid-stream.

## Sources

- `docs/explore/2026-06-06-content-marketing-engagement.md` (the model this refines; T3 surface
  decision) and ADR-0005/0007/0008/0010/0013/0018.
- `docs/reviews/2026-06-07-system-review-universal-triage.md` (the anti-strand invariant, the
  load-bearing seams to preserve).
- Breakcold CRM pipeline UI (owner reference for configurable kanban pipelines).
- Current code: `src/lib/triage/{read,decide}.ts`, `src/lib/comments/generate.ts`,
  `src/lib/qualify/status.ts`, `src/app/(app)/layout.tsx`.
