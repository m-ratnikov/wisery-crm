## 1. Dependencies and tooling

- [ ] 1.1 Add `pg` and `@types/pg`; remove `better-sqlite3` and `@types/better-sqlite3` from `package.json` (ADR-0001: Postgres, SQLite not used). Verify `npm ls better-sqlite3` reports it absent and `npm ls pg` resolves.
- [ ] 1.2 Add npm scripts: `db:generate` (`drizzle-kit generate`) and `db:migrate` (runs the migrator script from 5.2). Verify both scripts are listed by `npm run`.

## 2. Environment config (ADR-0003)

- [ ] 2.1 Extend the single Zod-validated env module to parse `DATABASE_URL` (pooled, for app queries) and `DIRECT_URL` (direct/session-mode, for DDL), failing fast if missing. No raw `process.env` reads elsewhere. Verify the module throws at boot when either var is unset.
- [ ] 2.2 Document both vars in `.env.example` (not committed secrets) with a one-line note on pooled vs direct. Verify the file lists both keys.

## 3. Schema definition (`src/db/schema.ts`)

- [ ] 3.1 Define pg enums `scan_status` (`running`, `completed`, `failed`) and `signal_kind` (`person`, `company`, `content`) per design D-F. Verify a `tsc --noEmit` typecheck passes against the enum types.
- [ ] 3.2 Define `sources`: `uuid` PK default `gen_random_uuid()`, `kind` text (adapter discriminator, not an enum - D-F), `name` text, `config` jsonb default `'{}'`, `cursor` jsonb nullable, `schedule` text nullable, `secret_ref` text nullable, `enabled` boolean default true, `created_at`/`updated_at` timestamptz (`updated_at` via Drizzle `.$onUpdate()` - D-G). Verify the table compiles and `updated_at` has an `$onUpdate` set.
- [ ] 3.3 Define `scans`: `uuid` PK, `source_id` uuid not null FK to `sources` `ON DELETE RESTRICT` (D-D), `status` `scan_status`, `started_at` timestamptz default now, `finished_at` timestamptz nullable, `items_fetched`/`signals_persisted`/`items_dropped` integer not null default 0, `error` text nullable. Add an index on `(source_id, started_at desc)`. Verify the FK uses RESTRICT, not cascade.
- [ ] 3.4 Define `signals`: `uuid` PK, `source_id` uuid not null FK RESTRICT, `scan_id` uuid not null FK RESTRICT, `kind` `signal_kind`, `dedup_key` text not null, `payload` jsonb not null, `created_at` timestamptz default now. No `updated_at` and no status column (append-only - D-C). Add `UNIQUE (source_id, dedup_key)` (D-B) and an index on `scan_id`. Verify the unique constraint and the absence of an `updated_at` column.

## 4. DB client (`src/db/client.ts`)

- [ ] 4.1 Create a `server-only` module that builds a `pg` Pool from `DATABASE_URL` (pooled endpoint, ADR-0001) and exports `db = drizzle(pool, { schema })`. Verify importing it from a client component fails the build (server-only guard works).

## 5. Drizzle config and first migration

- [ ] 5.1 Add `drizzle.config.ts`: dialect `postgresql`, `schema: src/db/schema.ts`, `out: src/db/migrations`, `dbCredentials` from `DIRECT_URL` (DDL on the direct endpoint, design D-H). Verify `drizzle-kit` reads it without error.
- [ ] 5.2 Add a migrator script (`src/db/migrate.ts`) that runs Drizzle's migrator against `DIRECT_URL`; wire it to `db:migrate`. It runs at deploy, NOT from `instrumentation.ts` (D-H, avoids multi-instance boot race). Verify the script exists and is not imported by `instrumentation.ts`.
- [ ] 5.3 Run `npm run db:generate` to produce the first migration SQL in `src/db/migrations`. Verify the generated SQL creates two enums, three tables, the `UNIQUE (source_id, dedup_key)`, the FK RESTRICT clauses, and the two indexes. (Migrations are immutable once applied - regenerate, do not hand-edit, if 3.x changes before apply.)

## 6. Apply and verify against Postgres

- [ ] 6.1 Run `npm run db:migrate` against managed Postgres. Verify `\dt` lists `sources`, `scans`, `signals` and `\dT` lists `scan_status`, `signal_kind`, all in the `public` schema (pg-boss owns `pgboss` separately, untouched).
- [ ] 6.2 Confirm the idempotency guard at the DB level: insert a signal, then re-insert the same `(source_id, dedup_key)` with `ON CONFLICT DO NOTHING`. Verify exactly one row exists.

## 7. Tests (Vitest)

- [ ] 7.1 Test idempotent persistence (spec: "Re-scan creates no duplicates"): inserting the same `(source_id, dedup_key)` twice yields one signal; the same `dedup_key` under a second source yields a distinct signal (spec: "Same identity from a different source is distinct").
- [ ] 7.2 Test traceability and immutability (spec: "Signal resolves to its source and scan", "Signal content is stable"): a persisted signal resolves its `source_id`/`scan_id`, and the schema exposes no mutation path for `payload`/`kind`.
- [ ] 7.3 Test source lifecycle (spec: "Retiring a source preserves its history"): setting `enabled = false` retains the source, and a delete attempt on a source with scans/signals is rejected by RESTRICT.
