## Why

The backbone (M0) left the data layer empty - zero tables, zero migrations - so there is nothing for the pipeline to stand on. Signals are the top of the funnel (D3): every later capability (qualify, enrich, draft, the queue) consumes persisted Signals that trace to a configured Source. This change builds that ingestion spine and the first walking slice of the pipeline - configure a Source, scan it, get deduped Signals - so the product has a foundation to qualify and draft against.

## What Changes

- **New data tables** (first Drizzle migration): `sources` (a configured origin, config-as-data), `scans` (one isolated run record per scan, with per-stage counts and status), `signals` (a deduped, append-only fact that traces to its source and scan).
- **The `SignalSource` connector contract** (D4, ADR-0004 normalize-at-the-edge): the interface a source type implements - it owns auth and paging and returns normalized items; the pipeline owns dedup and persistence. The contract is uniform from day one; concrete network adapters are not part of this change.
- **The scan pipeline**: one scan job per Source (failure isolation), run through the existing jobs facade - claim the source, run its connector, dedup, persist new Signals, and record the run's counts and outcome.
- **Idempotent re-scans**: persisting a Signal more than once for the same source and dedup key is a no-op, so re-scanning a source creates no duplicates.
- A **fixture connector** (deterministic, no network) ships with the change so the full loop runs and is integration-tested end to end against real Postgres. Real adapters (LinkedIn search, X) are deferred to `source-adapters` (roadmap #4).

Not in scope: prospect fan-out, qualification, enrichment, drafts, outcomes, or any downstream table; multi-tenant plumbing (D1); concrete network adapters. This change does **not** enqueue downstream qualify jobs on persist - the qualify consumer does not exist until `qualification` (roadmap #5), which adds that hook as its natural owner, so this change's job graph stays closed and orphans no jobs.

## Capabilities

### New Capabilities
- `signal-ingestion`: durable Sources as config-as-data; each scan recorded as an independent run with its counts and status; per-source idempotent Signal persistence; every Signal immutable and traceable to its source and scan; sources plug in through one normalize-at-the-edge connector contract and are scanned one job per source for failure isolation.

### Modified Capabilities
<!-- None. platform-runtime, background-jobs, and code-quality requirements are unchanged; this change reuses their mechanisms (db client, jobs facade, verify gate) without altering their contracts. -->

## Impact

- **Schema / migrations**: `src/lib/db/schema.ts` gains the three tables and two pg enums (`scan_status`, `signal_kind`); first migration generated into `./drizzle` (drizzle.config.ts already targets this schema and `APP_DATABASE_URL` - no new env vars, no `DIRECT_URL`).
- **New code**: the `SignalSource` port + `RawItem` shape + edge Zod validation; the scan-pipeline module (dedup + persist + scan-counts) wired through the `src/lib/jobs` facade; the in-repo fixture connector.
- **Reused seams** (no parallel mechanisms): data via `src/lib/db` (`getDb()`), config via `src/lib/config/env`, background work via the `src/lib/jobs` facade.
- **Tests**: integration tests against real Postgres (re-scan idempotency, scan-count recording, failure isolation, traceability) plus unit tests for the connector edge validation and dedup logic; the per-file coverage floor now applies to these new modules (and the `src/lib/jobs` facade exclusion is revisited per `docs/engineering.md`).
- **Governed by**: ADR-0001 (in-process pg-boss, peel-safety), ADR-0004 (thin pg-boss facade), the archived signal-connector contract, and Drizzle-migrations-immutable. Architecture homes: `docs/product-overview.md` section 4, `docs/architecture/system-design.md` (scan flow).
