## 1. Schema and migration

- [x] 1.1 Add the `prospects` table to `src/lib/db/schema.ts`: uuid PK, `signal_id` FK -> signals NOT NULL `ON DELETE RESTRICT`, `status` text NOT NULL, `...timestamps()` (D-A)
- [x] 1.2 Add the `scorings` table: uuid PK, `prospect_id` FK -> prospects NOT NULL RESTRICT, `rubric_id` FK -> rubric NOT NULL RESTRICT, `score` smallint NOT NULL, `reason` text, `summary` text, `prompt_version` text NOT NULL, `model` text NOT NULL, `scored_at` timestamptz default now (D-A)
- [x] 1.3 Add supporting indexes on `prospects.signal_id`, `scorings.prospect_id`, `scorings.rubric_id`
- [x] 1.4 Run `npm run db:generate`; review migration 3 (two tables, RESTRICT FKs, indexes); confirm ordered after migration 2, no new env var; `npm run db:migrate`

## 2. Prospect status vocabulary

- [x] 2.1 Create `src/lib/qualify/status.ts` (`server-only`): a Zod enum `prospectStatusSchema` for the states this capability uses (`new | scored | below_bar | qualified`) and a `gateStatus(score)` helper returning `qualified` (>= 3) or `below_bar` (< 3 or -1) (D-A, D-E)

## 3. The scorer (LLM port + active rubric)

- [x] 3.1 Create `src/prompts/icp_score_v1.ts`: the static scoring methodology as the prompt's `system` text (1-5 meaning, platform-awareness, the -1 insufficient-data/anti-hallucination rule, the output contract), exported as a `Prompt` (`name`, `version: "v1"`, `system`) (D-D)
- [x] 3.2 Create `src/lib/qualify/scorer.ts` (`server-only`): `scoreResultSchema` (`score` int in -1..5, `reason`, `summary`) and `scoreProspect(signal, { llm })` - read `getActiveRubric()` (hard error if none), build messages from the prompt system + rubric criteria + signal payload, call `llm.complete({ prompt, messages, schema: scoreResultSchema, model, maxTokens })`, return the validated result + the rubric id/version + result provider/model/promptVersion (D-C, D-D)

## 4. The qualify pipeline (fan-out, persist, gate)

- [x] 4.1 Create `src/lib/qualify/pipeline.ts` (`server-only`) `qualifySignal(signalId, { llm })`: load the signal; if a prospect already exists for it, no-op (idempotency, D-F); else fan out to person prospect(s) (N=1 for person, D-B)
- [x] 4.2 For each prospect, in one Drizzle transaction: insert the prospect, score it via `scoreProspect`, insert the `Scoring` (score, reason, summary, rubric_id, prompt_version, model), and set the prospect `status` via `gateStatus(score)` (D-E)

## 5. The qualify queue and the enqueue-on-persist hook

- [x] 5.1 Create `src/lib/qualify/qualify-queue.ts` (`server-only`): `enqueueQualify(signalId)`, `enqueueQualifyForSignals(ids)`, and `registerQualifyWorker()` over `src/lib/jobs` for the `qualify` queue, calling `qualifySignal(job.data.signalId)` with per-job try/catch isolation (D-E, mirroring the scan worker)
- [x] 5.2 In `src/lib/signals/pipeline.ts`, add `persistedSignalIds: string[]` to `ScanResult` and collect each newly-persisted signal's id (additive; existing counts/tests unchanged) (D-G)
- [x] 5.3 In `src/lib/signals/scan-queue.ts`, give `registerScanWorker(opts?: { onSignalsPersisted?: (ids: string[]) => Promise<void> })` and call the hook with `result.persistedSignalIds` after a completed scan (D-G)
- [x] 5.4 In `bootstrapNodeRuntime()`: `registerQualifyWorker()` after the scan worker, and wire `registerScanWorker({ onSignalsPersisted: enqueueQualifyForSignals })` so newly persisted signals are qualified (D-G); keep the jobs facade generic

## 6. Tests (fake LLM provider, no network)

- [x] 6.1 Unit-test `gateStatus`: >= 3 -> `qualified`; 2, 1, and -1 -> `below_bar`. Unit-test `scoreResultSchema`: valid scores pass, out-of-range and 0-with-no-meaning handled per schema
- [x] 6.2 Integration test (gated on `TEST_DATABASE_URL`, fake LLM via injection): qualifying a person signal creates exactly one prospect referencing the signal, with one Scoring recording score/reason/rubric_id/prompt_version/model (fan-out N=1; score is on the prospect)
- [x] 6.3 Integration test: a fake score of 4 -> prospect `qualified`; a fake score of 2 and a fake -1 -> `below_bar` and retained (the gate)
- [x] 6.4 Integration test: re-running `qualifySignal` for the same signal is a no-op (no second prospect/scoring) - idempotency under retry (D-F)
- [x] 6.5 Integration test: the scorer hard-errors when no active rubric exists (legible missing-config failure)
- [x] 6.6 Integration test (or focused unit): `runScan` returns `persistedSignalIds` containing only newly persisted signals; a re-scan returns an empty/duplicate-free set so nothing is re-qualified (D-F/D-G)

## 7. Verify, coverage, and docs

- [x] 7.1 Cover `src/lib/qualify/**` via the unit + integration tests; exclude only genuine network/boot glue (`qualify-queue.ts` worker registration) consistent with the scan-queue precedent, with a documented note
- [x] 7.2 Confirm no new env var; `ANTHROPIC_API_KEY` stays optional (fake provider used in tests)
- [x] 7.3 Run `npm run verify` green (typecheck, lint, format, depcruise, dup, per-file coverage, build) against a reachable test Postgres
- [x] 7.4 Run a `code-review` pass with architecture context and `/opsx:verify` (conformance to design + D5/ADR-0005/ADR-0003/D7) before archive
