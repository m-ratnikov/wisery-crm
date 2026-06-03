## Why

Signals are persisted but nothing acts on them yet. The qualifier is the cost gate and the noise cut (product-overview section 4): it turns a persisted Signal into the person(s) worth contacting, scores each against the active ICP rubric, and gates at >= 3 so only real prospects flow downstream. It is the first consumer of both the `LLMProvider` port (Wave 1) and the ICP config-as-data (Wave 2), and it closes the open hook `signal-ingestion` deliberately left: enqueue qualification when a new Signal lands.

## What Changes

- **Two data tables** (migration 3): `prospects` (a person under evaluation, `signal_id` FK, a Zod-validated `status` text, timestamps) and `scorings` (the per-person ICP rating: `prospect_id` + `rubric_id` FKs, `score` smallint, `reason`, `summary`, `prompt_version`, `model`, `scored_at`). Modeled in `docs/architecture/domain-model.md`.
- **Signal -> N prospect fan-out** (ADR-0005): a person signal yields one prospect; the one-to-many relation is exercised at N=1 now but is migration-free for the company/content path later. The score is recorded per prospect, never on the shared signal.
- **The ported 1-5 scorer** (D5): a versioned prompt (`src/prompts/icp_score_v<n>.ts`) that scores a prospect against the **active rubric read as config-as-data** (D6, not the hardcoded `ICP_SYSTEM_PROMPT`), returning `{ score, reason, summary }` through the `LLMProvider` port's structured-output contract. Platform-aware and anti-hallucination: a too-thin signal scores `-1` / insufficient-data rather than a guess.
- **The score gate** (D5): a Scoring `>= 3` moves the prospect to `qualified`; `< 3` or `-1` moves it to `below_bar` (retained silently for the learning loop, D7). The prospect's pipeline status is gated by its latest Scoring against the active rubric.
- **The enqueue-on-persist hook** (signal-ingestion D-L): persisting a new Signal enqueues a qualify job for it. The fan-out write (prospects + scorings + status) commits in one Drizzle transaction owned by the job handler; pg-boss shares the same Postgres so the writes and any follow-on enqueue are atomic.
- **D7 from day one**: each Scoring records its rubric version, prompt version, and model, so outcomes (logged later by `review-queue`) bind to the exact score and rubric a prospect was acted on - the learning loop becomes additive, not a migration.

Not in scope: enrichment, drafts, the review queue, or the `outcomes` table (later capabilities); the company/content expansion (`normalize-expand`, V2); re-scoring UI (the schema supports additive re-scores, but triggering them is later). No new concrete source connector.

## Capabilities

### New Capabilities
- `qualification`: a persisted Signal fans out to person Prospect(s); each Prospect is scored 1-5 (or -1 insufficient-data) against the active ICP rubric through the LLM port; a score gate at >= 3 qualifies a prospect and below-bar prospects are retained but not surfaced; every score is recorded per prospect with its rubric and prompt version for outcome-bound learning; a newly persisted Signal is automatically enqueued for qualification.

### Modified Capabilities
<!-- None at the spec level. The enqueue-on-persist behavior is qualification's own
requirement (below); realizing it touches signal-ingestion's persist point in code, but
that capability's dedup/persistence contract and Signal shape are unchanged - it is the
hook signal-ingestion's D-L reserved for its natural owner. -->


## Impact

- **Schema / migrations**: `src/lib/db/schema.ts` gains `prospects` + `scorings`; migration 3 (immutable, ordered after migration 2). `prospects.status` is text + Zod (the most churn-prone set, per domain-model enum policy); `scorings.score` is a smallint allowing `-1`.
- **New code**: `src/lib/qualify/` - the scorer (reads the active rubric, builds the prompt, calls the `LLMProvider` port, validates the result), the fan-out + persist logic, and the qualify job worker registered from the composition root; the first prompt `src/prompts/icp_score_v1.ts`.
- **Reused seams**: data via `src/lib/db`, LLM via the `LLMProvider` port (`getLLM()`, injectable for tests), config via `src/lib/icp` (`getActiveRubric`), background work via `src/lib/jobs` + the existing scan worker pattern. The enqueue hook reuses `signal-ingestion`'s pipeline persist point.
- **Tests**: integration tests (gated on `TEST_DATABASE_URL`) using the **fake LLM provider** (no network/key) - fan-out at N=1, score gate (>=3 qualified, <3/-1 below_bar), Scoring records rubric+prompt+model, re-scan does not double-score, enqueue-on-persist wiring. Unit tests for the scorer's prompt/result mapping.
- **Governed by**: D5 (ported scorer, gate, anti-hallucination, qualify split from draft), ADR-0005 (one-to-many fan-out, score per prospect), D6/D9 (rubric config-as-data, LLM via the port), D7 (score recorded with versions), ADR-0003 (structured output), Drizzle-migrations-immutable. Architecture: `docs/product-overview.md` sections 4-5, `docs/architecture/domain-model.md` (Prospect/Scoring, lifecycle, ProspectScored/ProspectQualified events).
