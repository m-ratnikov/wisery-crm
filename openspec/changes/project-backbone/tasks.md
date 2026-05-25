## 1. Dependencies and project config

- [x] 1.1 Remove `better-sqlite3` + `@types/better-sqlite3`; add `pg`, `@types/pg`, `pg-boss` (reconcile package.json with ADR-0001).
- [x] 1.2 Confirm TypeScript strict config and the Next 16 `src/` App Router layout (`src/app`, `src/lib`).
- [x] 1.3 Add npm scripts: `db:generate` and `db:migrate` (drizzle-kit); confirm `test` (vitest) still runs.

## 2. Configuration (`src/lib/config`)

- [x] 2.1 Zod env schema parsed once, fail-fast on missing/invalid, exported as a typed config object; `server-only`. Vars: `APP_DATABASE_URL` (pooled), `PGBOSS_DATABASE_URL` (direct), pool `max` for each, `ANTHROPIC_API_KEY`, provider keys, `LOG_LEVEL`, `NODE_ENV`.
- [x] 2.2 Commit `.env.example` documenting every var (dev values point at `localhost:5433`); confirm `.env` is gitignored.

## 3. Logging (`src/lib/log`)

- [x] 3.1 pino logger: level from config, `pino-pretty` transport in dev, redaction of secret fields (keys, connection strings).

## 4. Data layer (`src/lib/db`)

- [x] 4.1 Drizzle client over a `pg.Pool` (pooled app connection from config, explicit `max`); `server-only`.
- [x] 4.2 `drizzle.config.ts` + `drizzle/` migrations dir; `db:generate` an initial migration (no domain tables yet); `db:migrate` against local `localhost:5433`.
- [x] 4.3 A `SELECT 1` connectivity helper for the health check.

## 5. Background jobs (`src/lib/jobs`) - pg-boss facade (ADR-0004)

- [x] 5.1 pg-boss facade: construct pg-boss with its OWN connection (`PGBOSS_DATABASE_URL`, explicit `max`, `application_name=pgboss`); expose a thin surface (`start`, `stop`, `enqueue`, `schedule`, `work`).
- [x] 5.2 Register a no-op cron "heartbeat" job that logs each tick (proves the in-process worker runs).
- [x] 5.3 Graceful stop: `boss.stop({ graceful: true })`.

## 6. Bootstrap (`instrumentation.ts`)

- [x] 6.1 Read `node_modules/next/dist/docs/` for the Next 16 `register()` / runtime API and self-hosting shutdown notes (AGENTS.md) BEFORE writing.
- [x] 6.2 `instrumentation.ts` `register()`: nodejs-runtime guard, start pg-boss + register handlers (idempotent), wire a SIGTERM/SIGINT handler to the facade's graceful stop (set `NEXT_MANUAL_SIG_HANDLE` only if drain proves unreliable).

## 7. Walking-skeleton proof

- [x] 7.1 Health probe (route handler or RSC) that runs the `SELECT 1` check; no secret crosses to the client.
- [ ] 7.2 Manual boot smoke (`next dev`): env validates, DB connects, pg-boss starts, the heartbeat cron ticks, logs are structured, SIGTERM drains. (Compile verified by `next build`; worker behavior verified by the jobs test. The live dev observation is the remaining manual confirm.)
- [x] 7.3 Vitest: (a) env validation fails fast on a missing var; (b) DB connectivity round-trip; (c) one enqueue -> process -> complete job round-trip. DB-touching tests gate on `TEST_DATABASE_URL` and skip cleanly when unset.
- [x] 7.4 `npm test` green (including the existing `arch-links` and `mermaid` tests).
