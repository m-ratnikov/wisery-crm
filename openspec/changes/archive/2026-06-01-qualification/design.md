## Context

Signals persist (Wave 1), the `LLMProvider` port exists (Wave 1), and the ICP rubric + profile are config-as-data (Wave 2). Qualification is the cost gate (product-overview 4-5): fan a Signal out to person Prospect(s), score each against the active rubric through the LLM port, and gate at >= 3. It owns the enqueue-on-persist hook `signal-ingestion` deferred (D-L) and records each score per prospect with its rubric/prompt/model versions for the learning loop (D7, ADR-0005).

## Goals / Non-Goals

**Goals:** `prospects` + `scorings` tables (migration 3); signal -> N prospect fan-out (N=1 for person, ADR-0005); the ported 1-5 scorer reading the active rubric as config-as-data through the LLM port, with anti-hallucination (-1); the >= 3 gate; per-prospect Scoring with rubric/prompt/model versions; automatic qualification of newly persisted signals; idempotency (re-scan / job retry does not double-score).

**Non-Goals:** enrichment, drafting, the queue, the `outcomes` table; company/content expansion (`normalize-expand`, V2); a re-scoring trigger UI; a non-fixture source connector.

## Decisions

### D-A: Two tables (migration 3); status is text+Zod, score is smallint
`prospects` (`id` uuid, `signal_id` FK NOT NULL RESTRICT, `status` text, timestamps) and `scorings` (`id` uuid, `prospect_id` FK, `rubric_id` FK, `score` smallint, `reason` text, `summary` text, `prompt_version` text, `model` text, `scored_at` timestamptz). `status` is `text` validated by a Zod enum (the lifecycle is the most churn-prone set, per domain-model enum policy): `new | scored | below_bar | qualified` (later states - enriched/drafted/queued/acted/dismissed/closed - are added by their capabilities). `score` is a smallint that allows `-1` (insufficient data) through 5.

### D-B: Fan-out is one-to-many, exercised at N=1 for person signals (ADR-0005)
A `fanOut(signal)` step produces the person prospect(s) for a signal. A person signal yields exactly one prospect; the relation is one-to-many so the company/content path (normalize-expand, V2) adds prospect rows without a schema change. The score is a `Scoring` row referencing the prospect, never the signal. MVP is person sources only, so fan-out is 1:1 today; the seam is where expansion lands later.

### D-C: The scorer reads the active rubric and calls the LLM port
`scoreProspect(prospect, signal, { llm })` reads `getActiveRubric()` (D6, config-as-data), builds the messages from the static scorer prompt (methodology) plus the rubric criteria and the signal payload, and calls `llm.complete({ prompt, messages, schema: scoreResultSchema, model, maxTokens })`. `scoreResultSchema` is `{ score: int in -1..5, reason, summary }`. `llm` defaults to `getLLM()` and is injected as the fake provider in tests (no network/key). The active rubric's `id`/`version` and the result's `provider`/`model`/`promptVersion` are recorded on the Scoring.

### D-D: Prompt versioning separates methodology from criteria
`src/prompts/icp_score_v1.ts` holds the **static** scoring methodology as the prompt's system text (platform-awareness, the 1-5 meaning, the insufficient-data/anti-hallucination rule, the output contract) - versioned independently. The **dynamic** rubric criteria (config-as-data) and the signal payload go in the user message. So `prompt_version` identifies the methodology and `rubric_id`/version identifies the criteria; both are recorded (D5, domain-model), and editing the rubric does not change the prompt version.

### D-E: The qualify job - fan out, score, persist, gate, all in one transaction
`enqueueQualify(signalId)` sends a `qualify` job; `registerQualifyWorker()` works it. The handler: load the signal; if a prospect already exists for it, no-op (idempotency, D-F); else fan out, and for each prospect score it, then in one Drizzle transaction insert the prospect, insert its Scoring, and set `status` = `qualified` (score >= 3) or `below_bar` (score < 3 or -1). pg-boss shares the same Postgres, so the writes commit atomically (domain-model). The worker is registered from `bootstrapNodeRuntime()` after the scan worker, keeping the jobs facade generic.

### D-F: Idempotency - new-signals-only + prospect-exists guard
Two layers: (1) `signal-ingestion` only reports **newly persisted** signal ids (re-scan duplicates are dropped, never re-enqueued), and (2) the qualify handler skips a signal that already has a prospect. So a re-scan does not re-qualify, and a pg-boss retry of a qualify job does not create a second prospect or score. Re-scoring (additive new Scoring rows) is a deliberate future trigger, not this automatic path.

### D-G: The enqueue-on-persist hook is wired at the composition root, not by a signals->qualify import
`signal-ingestion` stays free of any qualification import. `runScan` returns the `persistedSignalIds` (additive to `ScanResult`); `registerScanWorker(opts?)` accepts an optional `onSignalsPersisted(ids)` callback and calls it after a completed scan. `bootstrapNodeRuntime()` (the composition root, which already imports both modules' registration functions) wires `registerScanWorker({ onSignalsPersisted: enqueueQualifyForSignals })`. Dependency direction stays qualify -> signals; the wiring lives at the root, exactly where the scan worker is already registered.

### D-H: Module layout - `src/lib/qualify/`, all `server-only`
- `scorer.ts` - `scoreProspect(...)`: active-rubric read, prompt build, LLM call, result validation. The `scoreResultSchema`.
- `pipeline.ts` - `qualifySignal(signalId, { llm })`: the fan-out + score + persist + gate transaction; the testable core.
- `qualify-queue.ts` - `enqueueQualify` / `enqueueQualifyForSignals` / `registerQualifyWorker`, thin over `src/lib/jobs`.
Reuses `src/lib/db`, the `LLMProvider` port, `src/lib/icp` (`getActiveRubric`), `src/lib/jobs`. The prompt lives in `src/prompts/`.

## Risks / Trade-offs

- **No active rubric when a qualify job runs** -> the handler treats a missing active rubric as a hard error (the job fails and retries); the config seed (icp-config) is expected to have run. Documented so a missing-config failure is legible, not a silent skip.
- **Person-only fan-out at N=1** -> the one-to-many relation is unused beyond N=1 until normalize-expand; a small modeling cost accepted to keep the company/content path migration-free (ADR-0005).
- **LLM cost/variance per score** -> qualify is the cheap signal-level gate (D5); the expensive enrich/draft happen only for the >= 3s downstream. Evals are per provider+model (ADR-0003); the gate may need per-model calibration later.
- **The scorer's network call is not unit-coverable** -> tests use the fake LLM provider for the whole pipeline; a live smoke needs a key (deferred, like llm-provider).
- **Editing `signal-ingestion`'s `runScan`/`registerScanWorker`** -> additive only (new return field, new optional opt); its archived contract and existing tests are unchanged.

## Migration Plan

1. Add `prospects` + `scorings` to `src/lib/db/schema.ts` (D-A); `db:generate` -> review migration 3 (ordered after 2); `db:migrate`.
2. Build `src/lib/qualify/` (scorer, pipeline, queue) and `src/prompts/icp_score_v1.ts`.
3. Add `persistedSignalIds` to `runScan`'s result and the `onSignalsPersisted` opt to `registerScanWorker`; wire `enqueueQualifyForSignals` from `bootstrapNodeRuntime()`.
4. Integration-test with the fake LLM provider (fan-out N=1, gate, Scoring versions, idempotency); unit-test the scorer result mapping and the status-gate function.
5. **Rollback:** drop `scorings` then `prospects` (nothing references them until enrichment/drafting); migrations immutable.

## Open Questions

- Per-call model/maxTokens defaults for scoring - a cheap model is the intent (cost gate); pinned in the scorer now, revisit with real evals.
- Whether qualify should batch multiple prospects per LLM call (job-monitor did) - start one prospect per call for isolation and simplicity; batch later if cost/latency warrants.
