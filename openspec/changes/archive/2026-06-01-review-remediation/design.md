## Context

A context-complete re-review of the four archived capabilities' fix deltas (the looping-review step the prior cycle skipped, now codified in `docs/engineering.md`) found three material issues invisible to `verify`. This change remediates them and pins the one genuinely new guarantee (qualification idempotency under concurrency) as a requirement.

## Goals / Non-Goals

**Goals:** make qualification idempotent under duplicate/concurrent enqueue without a DB unique on `signal_id` (ADR-0005); stop the scan and qualify workers from swallowing retryable failures (ADR-0001); classify an empty LLM response as a provider failure (D-H). **Non-Goals:** any feature, schema, or migration change; batching the workers; source adapters.

## Decisions

### D-A: Qualification idempotency via the `singleton` queue policy + the existing guard (Q1)
The `qualify` queue is created with `policy: "singleton"`. Verified against `node_modules/pg-boss/dist/plans.js`: the `singletonKey` dedup indexes fire only under a non-standard policy - `job_i2` is `UNIQUE (name, COALESCE(singleton_key,'')) WHERE state = 'active' AND policy = 'singleton'`. So under `singleton`, at most one qualify job per `signalId` is `active` at a time; a second enqueue waits rather than running concurrently. When it later runs, `qualifySignal`'s existing prospect-exists guard sees the committed prospect and no-ops. Together: no concurrent double-run (queue) + no post-completion re-run (guard) = exactly one prospect and one scoring per signal.

**Why not a unique index on `prospects.signal_id`:** ADR-0005 models signal->prospect one-to-many specifically so a company/content signal can expand into many prospects with no migration. A unique on `signal_id` would enforce 1:1 and reintroduce the exact migration ADR-0005 avoids. The idempotency therefore lives at the queue + guard layer, not as a schema constraint. (A per-signal advisory lock was considered; the queue policy is simpler, needs no lock-during-LLM, and is sufficient given the guard.)

### D-B: Workers propagate handler errors so pg-boss retries (S1)
The scan worker and qualify worker drop their broad per-job `try/catch`. A handler error now propagates, so pg-boss applies its retry policy and dead-letters genuine poison after the limit - the durability guarantee ADR-0001 names and background-jobs' "Retries and a dead-letter path" requirement already states. The `try/catch` was added for `batchSize > 1` sibling isolation, but the queues run at the default `batchSize = 1` where it gives no isolation benefit and only suppresses retry; if batching is ever adopted, isolation returns via a different mechanism (e.g. per-item settle), not a retry-swallowing catch. `enqueueQualifyForSignals` keeps its per-id catch (those are post-commit enqueues for already-persisted facts, not scan/qualify failures).

### D-C: An empty LLM response is a provider failure (L1)
In the Anthropic adapter, a null/undefined `parsed_output` after a successful HTTP call (verified in `lib/parser.js`: null only when the message has no text block - empty or truncated output) now raises `LLMProviderError`, not `LLMValidationError`. The port contract (D-H, `provider.ts`) defines a validation failure as "a result arrived but failed the schema" and a provider failure as "the call never produced a usable result"; an empty response is the latter and is often transient/retryable. A schema mismatch (the SDK throws `AnthropicError` "Failed to parse structured output") remains a validation failure via `toLLMError`.

## Risks / Trade-offs

- **`singleton` policy serializes same-signal jobs** - intended; different signals still run concurrently (per-key index). A duplicate enqueue still creates a queued job that later no-ops via the guard - negligible overhead, no double LLM spend.
- **Propagating errors makes a poison scan/qualify job retry then dead-letter** (e.g. a permanently-missing source) - bounded by the retry limit and visible in the dead-letter path; preferable to silently dropping a transient failure.
- **L1 is latent today** (no caller branches on `kind`) - fixing it now keeps the contract honest for the first consumer (drafting/queue retry logic).

## Migration Plan

No schema or migration change. Code-only: `qualify-queue.ts` (policy + remove swallow), `scan-queue.ts` (remove swallow), `anthropic.ts` (no-content -> provider error). **Rollback:** revert the three edits; the queue policy reverts on the next `createQueue` (pg-boss updates the queue's policy).

## Open Questions

- Whether to also set a `singleton` policy on the `source-scan` queue (a duplicate scan enqueue is already idempotent via per-source dedup, so lower value) - deferred.
