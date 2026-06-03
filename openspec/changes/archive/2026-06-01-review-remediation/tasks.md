## 1. Qualification idempotency (Q1)

- [x] 1.1 In `src/lib/qualify/qualify-queue.ts`, create the qualify queue with `policy: "singleton"` so `singletonKey: signalId` enforces one active job per signal (pg-boss `job_i2`); correct the comment that claimed queue-layer dedup on a standard queue (D-A)
- [x] 1.2 Keep `qualifySignal`'s prospect-exists guard as the post-completion layer; confirm no DB unique is added to `prospects.signal_id` (ADR-0005 preserved) (D-A)

## 2. Worker retry (S1)

- [x] 2.1 In `src/lib/signals/scan-queue.ts`, remove the broad per-job `try/catch` so a handler error propagates and pg-boss retries/dead-letters it; keep the `onSignalsPersisted` call on the success path (D-B)
- [x] 2.2 In `src/lib/qualify/qualify-queue.ts`, remove the broad per-job `try/catch` in `registerQualifyWorker` for the same reason; leave `enqueueQualifyForSignals`'s per-id catch (post-commit enqueues, not failures) (D-B)

## 3. LLM error classification (L1)

- [x] 3.1 In `src/lib/llm/anthropic.ts`, change the no-content branch (null/undefined `parsed_output`) to throw `LLMProviderError`, not `LLMValidationError`; update the comment to explain an empty/truncated response is a provider failure (D-C, D-H)

## 4. Tests

- [x] 4.1 Integration test (gated on `TEST_DATABASE_URL`, fake LLM): calling `qualifySignal` twice for the same signal creates exactly one prospect and one scoring (the guard; the queue policy is the concurrency layer) (Q1 idempotency requirement)
- [x] 4.2 Confirm the existing qualification suite still passes (fan-out, gate, versions) unaffected by the queue-policy change

## 5. Verify, re-review, docs

- [x] 5.1 Run `npm run verify` green (typecheck, lint, format, depcruise, dup, per-file coverage, build)
- [x] 5.2 Per the looping-review rule (`docs/engineering.md`), re-review THIS change's fix delta with full context before archive - confirm the `singleton` policy + guard close the TOCTOU, the worker error-propagation does not break the `onSignalsPersisted` path, and the LLM reclassification matches the port contract
- [x] 5.3 `/opsx:verify` (conformance to ADR-0005, ADR-0001, ADR-0003/D-H) and archive
