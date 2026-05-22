## Context

No persistence exists yet. `drizzle-orm` and `drizzle-kit` are installed but there is no `drizzle.config.ts`, no schema, no client, and no migrations; `package.json` still carries leftover `better-sqlite3` deps that contradict ADR-0001 (managed Postgres, SQLite not used). The architecture is otherwise settled: ADR-0001 (in-process pg-boss on managed Postgres, app queries on the pooled endpoint), ADR-0003 (one Zod-validated env module is the only `process.env` ingestion point), ADR-0004 (sources are config-as-data rows; connectors normalize at the edge; the pipeline owns dedup and Signal persistence).

This change stands up the first migration for the ingestion backbone only: `sources`, `scans`, `signals`. Downstream tables (prospects, qualifications, drafts, outcomes) are deferred. Because Drizzle migrations are immutable once applied, the conventions chosen here propagate to every later table, so they are decided deliberately below.

## Goals / Non-Goals

**Goals:**
- A Postgres Drizzle data layer: `drizzle.config.ts`, a typed schema, a `server-only` pooled DB client, and the first generated migration.
- Three tables that make ADR-0004 durable: a source as config-as-data, a scan as an isolated run record with per-stage counts, and a signal that persists exactly once per source dedup key.
- Conventions (keys, timestamps, JSONB boundary, enum policy, FK policy) set once, so downstream tables inherit them.

**Non-Goals:**
- No prospect fan-out, qualification, drafts, outcomes, or any downstream table.
- No `tenant_id`, auth, or multi-tenant plumbing (D1 / overview section 7).
- No connector implementations or scan job wiring (ADR-0004 contract is honored by the shape, but the worker and connectors are separate changes).
- No pg-boss schema modeling - pg-boss owns and migrates its own `pgboss` schema; our tables live in `public`.
- RawItem is deliberately not modeled - it is a transient in-flight DTO that may carry PII; only deduped Signals persist (system-design data-sensitivity note).

## Decisions

### D-A: Three tables, RawItem stays transient
`sources`, `scans`, `signals`. RawItem is not a table - it exists only between a connector returning normalized items and the dedup step. Alternative (persist RawItems for replay/audit) rejected: it stores un-deduped PII for no current consumer and contradicts the data-sensitivity stance. Replay, if ever needed, re-runs the scan.

### D-B: Per-source dedup uniqueness is the idempotency mechanism
`signals` carries a connector-provided `dedup_key` (stable item identity: normalized profile URL, post id, company domain, ...) and a `UNIQUE (source_id, dedup_key)`. Persistence is `INSERT ... ON CONFLICT (source_id, dedup_key) DO NOTHING`, so a re-scan inserts zero duplicates. Dedup is scoped **per source** on purpose: the same human surfacing from two different sources yields two signals. Cross-source identity resolution belongs to the (deferred) prospect layer, not here. Alternative (global dedup across sources) rejected: it couples connectors and forces premature identity resolution into the ingestion path.

### D-C: Signals are append-only; pipeline state lives in the queue, not on the row
A `signal` is an immutable fact once written (no `updated_at`, no pipeline `status` column). "New signals enter qualification" is realized by the persist step enqueuing the next pg-boss job (ADR-0001), not by polling a status flag. Alternative (a `status`/`processed_at` column the qualifier scans for) rejected for now: it duplicates what the durable queue already tracks and invites write contention on the hot table. If a queryable backlog of unprocessed signals is later needed, a follow-up change adds it additively.

### D-D: FKs use `ON DELETE RESTRICT`; lifecycle is `enabled`, not hard delete
`scans.source_id`, `signals.source_id`, and `signals.scan_id` are `NOT NULL` and `RESTRICT` on delete, which preserves the traceability the proposal promises (every signal traces to its source and scan) and prevents accidental history loss. A source is retired by setting `enabled = false`, not deleted. Hard removal is an explicit, child-first admin operation. Alternative (`CASCADE`) rejected: deleting a source would silently erase signals that future prospect rows will depend on.

### D-E: JSONB at the connector boundary, typed columns for everything queried
Connector-shaped, source-specific data is `jsonb` (`sources.config`, `sources.cursor`, `signals.payload`); anything filtered, joined, or constrained is a typed column. The DB does not validate JSONB - the connector's Zod schema validates at the edge before insert (ADR-0004 normalize-at-the-edge), and the DB trusts that boundary. This is the schema-flexibility seam: new source types add JSON shape, not columns.

### D-F: Enum policy - pg enum for closed domain sets, text for adapter-extensible sets
`scan_status` (`running` | `completed` | `failed`) and `signal_kind` (`person` | `company` | `content`) are genuine closed domain vocabularies, so they are pg enums (queryable, self-documenting; growth is an additive `ALTER TYPE ADD VALUE` migration). `sources.kind` (the connector discriminator: `linkedin-search`, `x-posts`, `company-csv`, ...) grows with every new adapter (D8), so it is `text` validated by Zod at the app boundary, never a DB enum that would fight immutable migrations.

### D-G: Identifier and timestamp conventions
PKs are `uuid DEFAULT gen_random_uuid()` (non-enumerable for eventual external exposure; v4 random is fine at single-user volume, and v7 can be adopted later without a type change). Timestamps are `timestamptz`. `created_at DEFAULT now()` everywhere; `sources.updated_at` is maintained via Drizzle `.$onUpdate()`. This fires only through Drizzle, which is acceptable because every write goes through Drizzle; if raw-SQL writes ever appear, a DB trigger replaces it.

### D-H: Client and migration mechanics
`src/db/client.ts` is `server-only`, builds a `pg` Pool from the **pooled** `DATABASE_URL` (ADR-0001 app queries), and exports `db = drizzle(pool, { schema })`. `drizzle.config.ts` targets the `postgresql` dialect, `out: src/db/migrations`, and uses the **direct** (session-mode) URL for DDL. Both URLs come from the ADR-0003 env module, never raw `process.env`. Migrations are applied by an explicit `db:migrate` script at deploy time, **not** auto-run from `instrumentation.ts`, to avoid a race when more than one instance boots (ADR-0001 allows multiple instances). Schema starts as a single `src/db/schema.ts`; it can split per-table when it grows.

## Risks / Trade-offs

- **Unvalidated JSONB could let malformed payloads land** → connector Zod validates at the edge before insert (ADR-0004); the DB trusts the normalized boundary, and bad connector output is a connector bug caught in its own tests.
- **Per-source dedup yields duplicate signals for one human across sources** → intentional; the actual requirement (re-scan idempotency) is fully met. Identity resolution is a deferred prospect-layer concern, called out so it is not mistaken for a bug.
- **`.$onUpdate()` only fires through Drizzle** → all writes go through Drizzle today; revisit with a DB trigger only if raw-SQL writers appear.
- **`RESTRICT` makes deleting a source with history error out** → intended; retire via `enabled = false`, and do explicit child-first cleanup for true removal.
- **`gen_random_uuid()` is v4, not time-sortable** → negligible index-locality cost at single-user volume; adopting v7 later needs no type change.
- **No pipeline status on signals** → relies on durable pg-boss enqueue-on-persist; if a job is lost, that signal is not re-picked. Mitigated by pg-boss durability/retries; a backlog query can be added additively if reprocessing is ever required.

## Migration Plan

1. Swap deps: add `pg` + `@types/pg`, remove `better-sqlite3` + `@types/better-sqlite3`.
2. Extend the ADR-0003 env module with `DATABASE_URL` (pooled) and `DIRECT_URL` (direct, for DDL).
3. Add `src/db/schema.ts` (enums + three tables), `src/db/client.ts` (`server-only`, pooled), `drizzle.config.ts` (direct URL).
4. `drizzle-kit generate` to produce the first migration into `src/db/migrations`.
5. Apply with the `db:migrate` script against managed Postgres; verify the three tables, two enums, the `UNIQUE (source_id, dedup_key)`, and the FK + supporting indexes exist.
6. **Rollback:** nothing depends on these tables yet, so the down path drops the three tables and two enums; risk is low. Drizzle migrations are immutable - any later correction is a new migration, never an edit.

## Open Questions

- Whether `sources.cursor` (connector-owned incremental paging state) is needed in this first cut or can wait for the first incremental connector. Included now as nullable `jsonb` since it is cheap and connector-owned; drop if the first adapters prove stateless.
- Exact scan-scheduling representation (cron string in `sources.schedule` vs. pg-boss scheduling owning cadence). Modeled as a nullable text cron expression for now; revisit when the scan job is wired.
