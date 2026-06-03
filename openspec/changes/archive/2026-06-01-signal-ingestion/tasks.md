## 1. Schema and migration

- [x] 1.1 Add the `scan_status` (`running` | `completed` | `failed`) and `signal_kind` (`person` | `company` | `content`) pg enums to `src/lib/db/schema.ts` (D-F)
- [x] 1.2 Add the `sources` table: uuid PK (`gen_random_uuid()`), `kind` text, `config` jsonb, `cursor` jsonb nullable, `schedule` text nullable, `enabled` boolean default true, `created_at` timestamptz default now, `updated_at` timestamptz via `.$onUpdate()` (D-A, D-D, D-E, D-G)
- [x] 1.3 Add the `scans` table: uuid PK, `source_id` FK -> sources NOT NULL `ON DELETE RESTRICT`, `status` scan_status default `running`, `started_at` / `finished_at` timestamptz, `fetched_count` / `persisted_count` / `dropped_count` integer default 0, `error` text nullable, `created_at` (D-D, D-G)
- [x] 1.4 Add the `signals` table: uuid PK, `source_id` + `scan_id` FKs NOT NULL `ON DELETE RESTRICT`, `kind` signal_kind, `dedup_key` text, `payload` jsonb, `created_at`; no `updated_at` (append-only, D-C); `UNIQUE (source_id, dedup_key)` (D-B)
- [x] 1.5 Add supporting indexes on `scans.source_id`, `signals.source_id`, `signals.scan_id` (the unique constraint covers the dedup lookup)
- [x] 1.6 Run `npm run db:generate` and review the generated SQL in `./drizzle` (enums, tables, unique, RESTRICT FKs, indexes); confirm no `DIRECT_URL` or new env var is required (D-H)
- [x] 1.7 Run `npm run db:migrate` against dev Postgres and confirm the three tables and two enums exist

## 2. Connector contract (the D4 port)

- [x] 2.1 Create `src/lib/signals/connector.ts` (`server-only`): the `SignalSource` interface (`readonly kind`, `scan(source): AsyncIterable<RawItem>`), the `RawItem` type, and the inferred row types from the schema (D-I, D-J)
- [x] 2.2 Add the `RawItem` Zod schema (`kind` in the signal_kind set, non-empty `dedupKey`, `payload` passthrough) used by the pipeline to validate at the edge (D-E, D-J)

## 3. Scan pipeline

- [x] 3.1 Create `src/lib/signals/pipeline.ts` (`server-only`) `runScan(sourceId)`: load the source, open a `scans` row (`running`), look up the connector via the registry, consume `scan(source)` with `for await`, validate each item with the `RawItem` schema, dedup-insert via `.onConflictDoNothing({ target: [sourceId, dedupKey] }).returning()`, tally fetched/persisted/dropped, close the scan `completed` with counts and `finished_at` (D-B, D-J)
- [x] 3.2 Handle a connector that throws mid-iteration: mark that scan `failed` with the error and `finished_at`, do not throw out of `runScan` (so one source's failure is isolated) (D-D, spec: failing source does not stall others)
- [x] 3.3 Count an item that fails edge validation as dropped (not persisted), alongside dedup drops (spec: item failing edge validation is not persisted)

## 4. Registry and fixture connector

- [x] 4.1 Create `src/lib/signals/registry.ts` (`server-only`): map `source.kind` -> `SignalSource`; `getConnector(kind)`; register the fixture. This is the only module that imports concrete connectors (D-I, D-M)
- [x] 4.2 Create `src/lib/signals/connectors/fixture.ts` (`server-only`): a deterministic, no-network `SignalSource` (`kind: "fixture"`) yielding a fixed set of `RawItem`s driven by `source.config`, including a repeated dedup_key (to exercise dedup) and an intentionally invalid item (to exercise edge-validation drop)

## 5. Scan queue and worker

- [x] 5.1 Create `src/lib/signals/scan-queue.ts` (`server-only`): `enqueueScan(sourceId)` over `src/lib/jobs` `enqueue`, and `registerScanWorker()` over `work` that calls `runScan(job.data.sourceId)` for the `source-scan` queue (D-K)
- [x] 5.2 Call `registerScanWorker()` from `bootstrapNodeRuntime()` after `startJobs()`, keeping the `src/lib/jobs` facade generic (no signal-specific knowledge) (D-K)

## 6. Architectural boundary

- [x] 6.1 Add a dependency-cruiser rule to `.dependency-cruiser.cjs`: `connector.ts` and `pipeline.ts` MUST NOT import anything under `src/lib/signals/connectors/`; concrete connectors are reached only through `registry.ts` (D-M, the engineering.md extension point)
- [x] 6.2 Run `npm run depcruise` and confirm the new rule passes

## 7. Tests

- [x] 7.1 Unit-test the `RawItem` Zod schema (valid item passes; missing/blank `dedupKey` and out-of-set `kind` fail)
- [x] 7.2 Integration test (gated on `TEST_DATABASE_URL`, isolated schema like the pg-boss tests): scanning the fixture source persists the expected signals, records the scan `completed` with correct fetched/persisted/dropped counts, and each signal resolves to its source and scan (spec: completed scan counts; signal traces to origin)
- [x] 7.3 Integration test: re-scanning the same source creates no duplicate signals and counts repeats as dropped; an existing signal's payload and kind are unchanged (spec: re-scan idempotency; signal stable after persistence)
- [x] 7.4 Integration test: the same dedup_key under a different source persists as a distinct signal (spec: same identity from a different source is distinct)
- [x] 7.5 Integration test: a connector that throws records that scan `failed` with its error while another source's scan completes unaffected (spec: failed scan captured independently; failing source does not stall others)
- [x] 7.6 Integration test: disabling a source after it has produced scans and signals retains the source disabled and leaves its history intact (spec: retiring a source preserves its history)

## 8. Verify, coverage, and docs

- [x] 8.1 Revisit the `src/lib/jobs/**` coverage exclusion in `vitest.config.ts` per `docs/engineering.md` now that the scan path exercises the facade; keep the exclusion only if the facade stays pure delegation, otherwise cover it via the scan integration test rather than a performative test, and update the exclusion note
- [x] 8.2 Update `.env.example` only if a new variable is introduced (expected: none) and confirm the change adds no new env vars
- [x] 8.3 Run `npm run verify` green (typecheck, lint, format, depcruise, dup, per-file coverage, build) against a reachable test Postgres
- [x] 8.4 Run a `code-review` pass with architecture context and `/opsx:verify` (conformance to design + ADRs) before archive
