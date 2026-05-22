## Why

The architecture is fully specified (ADR-0001 Postgres + pg-boss, ADR-0004 the connector contract) but no schema exists yet: Drizzle is installed with no config, no tables, and no migrations, so nothing in the pipeline can persist. The first migration must stand up the ingestion backbone - the durable record of configured sources, their scan runs, and the deduped signals they produce - because every downstream stage (qualify, enrich, draft, queue) reads from it. Getting this first migration right matters: migrations are immutable once applied.

## What Changes

- Add the Drizzle Postgres data layer: a `drizzle.config.ts`, a schema module, a typed DB client over the pooled Postgres endpoint (per ADR-0001), and the first generated migration.
- Define three tables for the ingestion backbone:
  - `sources` - a configured external origin as config-as-data (type, connector config, schedule, enabled flag, secret reference).
  - `scans` - one durable run per source claim, recording status, timing, and per-stage counts (fetched / persisted / dropped) for isolation and observability.
  - `signals` - deduped, persisted items, each carrying a normalized payload and the originating source + scan, with a uniqueness guarantee that makes re-scans idempotent.
- **RawItem is intentionally NOT a table.** Per the system-design data-sensitivity note, raw items are transient in-flight DTOs (they may carry PII); only deduped Signals persist.
- No `tenant_id` and no auth (D1 / overview section 7 defer all multi-tenant plumbing); the schema is single-tenant-first, with the productization path left additive.
- **BREAKING / cleanup:** remove the leftover `better-sqlite3` + `@types/better-sqlite3` dependencies, which contradict ADR-0001 (managed Postgres, SQLite not used), and add the Postgres driver.

## Capabilities

### New Capabilities
- `signal-ingestion`: the persistence contract for the ingestion backbone - registering a source as durable config, recording each scan run with per-source isolation and counts, and persisting signals exactly once per source dedup key so re-scans are idempotent and every signal traces back to its source and scan.

### Modified Capabilities
<!-- None. No specs exist yet; this seeds the first capability. -->

## Impact

- **New code:** `drizzle.config.ts`, `src/db/schema.ts` (or `src/db/schema/`), `src/db/client.ts` (`server-only`, pooled `pg`), `src/db/migrations/`.
- **Dependencies:** add `pg` (+ `@types/pg`); remove `better-sqlite3` and `@types/better-sqlite3`. `drizzle-orm` / `drizzle-kit` already present, switched to the Postgres dialect.
- **Config:** consumes the Postgres connection string through the single Zod-validated env module (ADR-0003); no raw `process.env` reads.
- **Honors:** ADR-0001 (Postgres, pooled endpoint for app queries; pg-boss owns its own `pgboss` schema separately), ADR-0004 (pipeline owns dedup + Signal persistence; sources are config-as-data rows).
- **Downstream (out of scope):** prospect fan-out, qualification/scores, drafts, outcomes - later changes add tables and extend the `signal-ingestion` spec or add new capabilities.
