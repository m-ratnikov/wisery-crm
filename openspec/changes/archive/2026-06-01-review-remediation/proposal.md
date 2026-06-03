## Why

A context-complete re-review of the fix deltas from the four archived capabilities (a re-review the prior cycle skipped) found three material correctness issues that the `verify` gate cannot see - they pass typecheck/lint/coverage/build because no test exercises the concurrency, retry, or error-classification path. The most serious is that a prior fix was inert: the qualify queue's `singletonKey` does nothing on a pg-boss `standard`-policy queue, so qualification has no working idempotency backstop. This change remediates all three and pins each fixed behavior as an explicit, tested requirement so it cannot silently regress.

## What Changes

- **Qualification idempotency (Q1).** The `qualify` queue is created with the **`singleton`** policy so `singletonKey: signalId` actually enforces one active qualify job per signal (pg-boss `job_i2` partial unique index fires only under a non-standard policy - verified against `node_modules/pg-boss`). Combined with the existing prospect-exists guard in `qualifySignal`, a duplicate or concurrent enqueue of one signal yields exactly one prospect and one LLM call. **No DB unique on `prospects.signal_id`** - that would break the one-to-many fan-out ADR-0005 keeps migration-free.
- **Background-job retry (S1).** The scan worker and the qualify worker no longer swallow handler errors. A transient failure (e.g. a DB blip before a scan run opens, or a transient error in `qualifySignal`) now propagates so pg-boss retries it and dead-letters genuine poison after the retry limit, restoring the durability guarantee ADR-0001 names. The premature per-job `try/catch` was only needed for `batchSize > 1` (we run the default `batchSize = 1`); reintroduce isolation differently if batching is ever adopted.
- **LLM error classification (L1).** The Anthropic adapter's no-content branch (null `parsed_output` after a successful HTTP call - an empty or truncated response, often transient) now raises `LLMProviderError`, not `LLMValidationError`. A validation error means "a result arrived but failed the schema"; an empty response produced no result, which the port contract (D-H) defines as a provider failure a caller may retry.

Not in scope: any new feature; the company/content expansion; source adapters. No new tables or migrations (Q1 is a queue-policy change; S1/L1 are code-only).

## Capabilities

### Modified Capabilities
- `qualification`: ADD an explicit idempotency-under-concurrency guarantee (one prospect + one scoring per signal even under duplicate or concurrent processing). This is the one genuinely new requirement.

<!-- S1 and L1 introduce NO new requirement - they restore conformance to requirements that
already exist, so they need no delta:
- S1 (worker retry) restores background-jobs' existing "Retries and a dead-letter path: A
  failing job SHALL be retried" - the swallowing workers were defeating it.
- L1 (no-content -> provider error) restores llm-provider's existing "Results are validated
  and failures are typed" - it was misclassifying a provider failure as a validation one. -->


## Impact

- **Code:** `src/lib/qualify/qualify-queue.ts` (queue policy; stop swallowing), `src/lib/signals/scan-queue.ts` (stop swallowing), `src/lib/llm/anthropic.ts` (no-content -> `LLMProviderError`).
- **Tests:** an integration test that a duplicate/second `qualifySignal` for one signal creates no second prospect (the guard, now backed by the queue policy); a unit/contract test that the no-content path yields `LLMProviderError`. The worker-retry behavior is asserted by reasoning + the removal of the swallow (the workers are coverage-excluded boot glue).
- **No schema/migration change.** `prospects.signal_id` stays non-unique (ADR-0005).
- **Provenance:** these are correctness fixes that make the code meet the spirit of the existing specs; the deltas pin that spirit as explicit requirements. Governed by ADR-0005 (no signal_id unique), ADR-0001 (pg-boss retries as durability), ADR-0003/D-H (typed LLM errors). Found by the context-complete re-review recorded in `docs/engineering.md` (the looping review rule).
