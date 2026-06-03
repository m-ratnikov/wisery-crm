## Context

The backbone (M0) shipped config, a pooled Drizzle client (`src/lib/db`), logging, and an in-process pg-boss facade (`src/lib/jobs`), but `src/lib/db/schema.ts` is empty - zero tables, zero migrations. `drizzle.config.ts` already targets that schema file and `APP_DATABASE_URL`, and `db:generate` / `db:migrate` scripts exist. The architecture is settled: ADR-0001 (in-process pg-boss on managed Postgres, peel-safe so web and worker share state only through Postgres), ADR-0004 (the thin pg-boss facade is for testability, not portability), the archived signal-connector contract (sources are config-as-data; connectors normalize at the edge; the pipeline owns dedup and persistence; one scan job per source), and the product spine (`docs/product-overview.md` section 4, `docs/architecture/system-design.md` scan flow).

This change builds the ingestion spine plus the first walking slice of the pipeline. Because Drizzle migrations are immutable once applied, the schema conventions chosen here propagate to every later table, so they are decided deliberately. It supersedes the path and env assumptions of the never-implemented `initial-db-schema` design (which named `src/db/` and a `DIRECT_URL`); the real backbone uses `src/lib/db/` and a single `APP_DATABASE_URL`, and the still-valid data decisions from that design are carried forward below.

## Goals / Non-Goals

**Goals:**
- A Postgres Drizzle data layer for ingestion: `sources`, `scans`, `signals` in `src/lib/db/schema.ts` + the first generated migration in `./drizzle`.
- The `SignalSource` connector contract (D4): the interface a source type implements, the `RawItem` normalized shape, and its Zod validation applied at the edge by the pipeline.
- A scan pipeline run as one pg-boss job per source (failure isolation, ADR-0004 facade): claim source -> run connector -> dedup -> persist new Signals -> record the run's counts and outcome.
- A deterministic in-repo fixture connector so the whole loop is integration-tested end to end against real Postgres, with no network.
- Schema conventions (keys, timestamps, JSONB boundary, enum policy, FK policy) set once so downstream tables inherit them; the D4 port/adapter seam encoded as a dependency-cruiser rule (the documented extension point in `docs/engineering.md`).

**Non-Goals:**
- No prospect fan-out, qualification, enrichment, drafts, outcomes, or any downstream table.
- No `tenant_id`, auth, or multi-tenant plumbing (D1, overview section 7).
- No concrete network adapters (LinkedIn search, X) - those are `source-adapters` (roadmap #4). Only the fixture connector ships here.
- No downstream qualify enqueue on persist (see D-L) - that hook is owned by `qualification` (roadmap #5).
- No per-source cron scheduler (see D-K) - scans are triggered through an enqueue function this change provides; the `sources.schedule` column is reserved for that follow-up.
- No `RawItem` table - it is a transient DTO (D-A).

## Decisions

Carried forward from the archived `initial-db-schema` design (still correct, paths updated to the real backbone):

### D-A: Three tables, RawItem stays transient
`sources`, `scans`, `signals`. `RawItem` exists only between a connector yielding a normalized item and the dedup step - never a table. Persisting un-deduped RawItems would store PII for no current consumer and contradicts the data-sensitivity stance; replay, if ever needed, re-runs the scan.

### D-B: Per-source dedup uniqueness is the idempotency mechanism
`signals` carries a connector-provided `dedup_key` (stable item identity: normalized profile URL, post id, company domain, ...) with `UNIQUE (source_id, dedup_key)`. Persistence is `INSERT ... ON CONFLICT (source_id, dedup_key) DO NOTHING ... RETURNING` (Drizzle `.onConflictDoNothing(...).returning()`): an empty return means it was a duplicate (counted dropped), a row returned means persisted. Dedup is scoped per source on purpose; the same human from two sources yields two signals. Cross-source identity resolution belongs to the deferred prospect layer. Global dedup is rejected: it couples connectors and forces premature identity resolution into ingestion.

### D-C: Signals are append-only; pipeline state lives in the queue, not on the row
A signal is immutable once written: no `updated_at`, no pipeline `status` column. "New signals enter qualification" will be realized by the persist step enqueuing the next job (see D-L), not by polling a status flag. A `status`/`processed_at` column is rejected for now: it duplicates what the durable queue tracks and invites write contention on the hot table. A queryable backlog, if ever needed, is an additive follow-up.

### D-D: FKs are `NOT NULL` + `ON DELETE RESTRICT`; lifecycle is `enabled`, not hard delete
`scans.source_id`, `signals.source_id`, and `signals.scan_id` are `NOT NULL` and `RESTRICT` on delete, preserving the promised traceability (every signal traces to its source and scan) and preventing accidental history loss. A source is retired with `enabled = false`. `CASCADE` is rejected: deleting a source would silently erase signals future prospect rows depend on.

### D-E: JSONB at the connector boundary, typed columns for everything queried
Connector-shaped, source-specific data is `jsonb` (`sources.config`, `sources.cursor`, `signals.payload`); anything filtered, joined, or constrained is a typed column. The DB does not validate JSONB - the connector contract's Zod schema validates at the edge before insert (D-J), and the DB trusts that boundary. This is the schema-flexibility seam: a new source type adds JSON shape, not columns.

### D-F: Enum policy - pg enum for closed sets, text for adapter-extensible sets
`scan_status` (`running` | `completed` | `failed`) and `signal_kind` (`person` | `company` | `content`) are closed domain vocabularies, so they are pg enums (queryable, self-documenting; growth is an additive `ALTER TYPE ADD VALUE`). `sources.kind` (the connector discriminator: `fixture`, later `linkedin-search`, `x-posts`, ...) grows with every adapter (D8), so it is `text` validated by Zod at the app boundary, never a DB enum that would fight immutable migrations.

### D-G: Identifier and timestamp conventions
PKs are `uuid` defaulting to `gen_random_uuid()` (non-enumerable for eventual external exposure; v4 is fine at single-user volume, v7 adoptable later with no type change - built into Postgres 16, no `pgcrypto` extension step needed). Timestamps are `timestamptz`; `created_at` defaults to `now()` everywhere; `sources.updated_at` is maintained via Drizzle `.$onUpdate()` (fires through Drizzle, which is acceptable because every write goes through Drizzle; a DB trigger replaces it only if raw-SQL writers ever appear).

New to this change (the walking-pipeline and contract decisions):

### D-H: Migration mechanics reuse the existing tooling
`db:generate` writes the first migration into `./drizzle`; `db:migrate` applies it. Both use `APP_DATABASE_URL` via the existing `drizzle.config.ts` - no new env vars and no `DIRECT_URL` (the backbone settled on one URL for app queries and DDL at single-user scale; pg-boss keeps its own pool per ADR-0001). Migrations are applied by the explicit `db:migrate` script at deploy time, not auto-run from `instrumentation.ts`, to avoid a race when more than one instance boots (ADR-0001).

### D-I: Module layout - data in `src/lib/db`, the pipeline and contract in `src/lib/signals`
The three tables live in the existing `src/lib/db/schema.ts` (data layer, reached via `getDb()`). A new `src/lib/signals/` module holds the ingestion logic, all `server-only`:
- `connector.ts` - the `SignalSource` port (the interface a source type implements) + the `RawItem` type + its Zod schema. The port is the connector behavior; the config row is a `Source` - named distinctly to avoid confusion.
- `pipeline.ts` - `runScan(sourceId)`: the testable orchestration core (load source, open a scan run, consume the connector, validate-dedup-persist each item, tally counts, close the run completed or failed). It depends on `src/lib/db` only.
- `registry.ts` - maps a `source.kind` string to its `SignalSource` instance. This is the D4 seam where adapters register; this change registers only the fixture.
- `connectors/fixture.ts` - the deterministic, no-network connector.
- `scan-queue.ts` - `enqueueScan(sourceId)` and `registerScanWorker()`, both thin wrappers over the `src/lib/jobs` facade.

Reuses, no parallel mechanisms: data via `src/lib/db` (`getDb()`, `schema`), config via `src/lib/config/env`, background work via the `src/lib/jobs` facade (`enqueue`/`work`/`getBoss`).

### D-J: The connector contract is normalize-at-the-edge, paging-friendly, validated by the pipeline
```ts
interface SignalSource {
  readonly kind: string;                       // matches sources.kind
  scan(source: SourceRow): AsyncIterable<RawItem>;
}
type RawItem = { kind: SignalKind; dedupKey: string; payload: unknown };
```
`scan` returns an `AsyncIterable` so a connector pages lazily and the pipeline dedups incrementally rather than buffering a whole source in memory - honoring "the connector owns auth and paging." The connector is responsible for producing normalized items; the **pipeline** applies the `RawItem` Zod schema to each yielded item at the edge (D-E) before insert. An item failing validation is not persisted and is counted dropped (spec: "An item that fails edge validation is not persisted"). A connector raising mid-iteration fails that scan only (D-D traceability + spec isolation). Alternative (`scan(): Promise<RawItem[]>`) rejected: it forces full-buffering and a weaker paging story for the real adapters that follow.

### D-K: Scans are triggered via an enqueue function and run one job per source; a per-source cron scheduler is deferred
`enqueueScan(sourceId)` sends one `source-scan` job; `registerScanWorker()` works that queue, calling `runScan(job.data.sourceId)`. One job per source gives pg-boss-level failure isolation and retry (ADR-0004). The worker is registered from `bootstrapNodeRuntime()` (the composition root) right after `startJobs()`, so the generic jobs facade stays free of signal-specific knowledge. Splitting `runScan` (the DB-touching core) from the worker wrapper keeps the pipeline behavior deterministically testable by direct call, with the queue path covered separately. A per-source cron scheduler (reading `sources.schedule` and registering pg-boss schedules, reconciling on source change) is deferred: the `schedule` column is reserved for it, but the triggered path fully exercises the spec now without the scheduler-reconciliation machinery.

### D-L: No downstream qualify enqueue on persist yet
The persist step does not enqueue a qualify job - the qualify consumer does not exist until `qualification` (roadmap #5). Wiring it now would create a `qualify` queue with no worker and accumulate orphaned jobs. `qualification` is the natural owner of the enqueue-on-persist hook and adds it when it lands. This change's job graph stays closed (the `source-scan` queue only). Honors ADR-0001 peel-safety: the only cross-role state is Postgres rows and queue jobs.

### D-M: Encode the D4 port/adapter direction as a dependency-cruiser rule
`docs/engineering.md` reserved an extension point: "as the D4/D9 ports land, add 'adapters depend on ports, never the reverse' rules." This change lands the first port (`SignalSource`) and adapter (the fixture), so it adds the rule: `connector.ts` (the port) and `pipeline.ts` MUST NOT import anything under `connectors/`; concrete connectors are reached only through `registry.ts` (the single composition point that wires `kind` to instance). This protects the seam by the build, exactly the one mechanically enforceable SOLID principle (dependency inversion).

## Risks / Trade-offs

- **Unvalidated JSONB could let malformed payloads land** -> the pipeline runs the `RawItem` Zod schema at the edge before insert (D-E/D-J); the DB trusts the normalized boundary. A connector emitting bad shapes is a connector bug caught by the dropped-count assertion in its own tests.
- **Per-source dedup yields duplicate signals for one human across sources** -> intentional; the actual requirement (re-scan idempotency) is fully met. Cross-source identity resolution is a deferred prospect-layer concern, called out so it is not mistaken for a bug.
- **`.$onUpdate()` only fires through Drizzle** -> all writes go through Drizzle today; revisit with a DB trigger only if raw-SQL writers appear.
- **`RESTRICT` makes deleting a source with history error out** -> intended; retire via `enabled = false`, with explicit child-first cleanup for true removal.
- **No pipeline status on signals** -> relies on durable pg-boss enqueue (added by `qualification`); a lost job means that signal is not re-picked. Mitigated by pg-boss durability/retries; a backlog query is an additive follow-up if reprocessing is ever needed.
- **Triggered-only scans (no cron yet)** -> a source does not scan itself on a cadence until the deferred scheduler lands. Acceptable: the spec is about durability, isolation, and idempotency, all exercised by the triggered path; cadence is additive and does not touch the schema except the already-present `schedule` column.
- **The `src/lib/jobs` coverage exclusion** -> `docs/engineering.md` flagged it to revisit "when `signal-ingestion` lands." This change adds the first real enqueue/work through the facade; the scan integration test exercises the facade, so the exclusion is reconsidered in tasks (keep it only if the facade stays pure delegation; otherwise cover it via the scan path rather than a performative test).

## Migration Plan

1. Add the three tables + two pg enums to `src/lib/db/schema.ts` (conventions D-A..D-G), with supporting indexes on the FK columns (`scans.source_id`, `signals.source_id`, `signals.scan_id`); the `UNIQUE (source_id, dedup_key)` doubles as the dedup-lookup index.
2. `npm run db:generate` to produce the first migration into `./drizzle`; review the generated SQL (enums, tables, unique, FKs `RESTRICT`, indexes).
3. `npm run db:migrate` against the dev Postgres; verify the objects exist.
4. Build the contract, pipeline, registry, fixture, and scan-queue modules (D-I..D-M); register the scan worker from `bootstrapNodeRuntime()`.
5. Add the dependency-cruiser port/adapter rule (D-M) and confirm `depcruise` passes.
6. Integration-test the loop end to end against real Postgres (gated on `TEST_DATABASE_URL`, isolated like the pg-boss tests): re-scan idempotency, scan-count recording, edge-validation drop, traceability, and per-source failure isolation.
7. **Rollback:** nothing depends on these tables yet, so the down path drops the three tables and two enums; risk is low. Migrations are immutable - any later correction is a new migration, never an edit.

## Open Questions

- Exact scan-scheduling representation (cron in `sources.schedule` vs. pg-boss owning cadence). Deferred per D-K; the column is modeled as nullable text now, wired when the scheduler change lands.
- Whether `sources.cursor` (connector-owned incremental paging state) is needed in this first cut. Included now as nullable `jsonb` since it is cheap and connector-owned; drop it if the first real adapters prove stateless.
- Whether the fixture connector stays a test-only fixture or graduates into a documented `examples`/seed source for local development. Treated as test-scoped here; revisit if a seed source proves useful for the anchor-view work.
