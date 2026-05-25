## Context

No application code exists yet; the repo holds architecture canon (L1/L2, ADR-0001..0004) and a `package.json` that contradicts it (sqlite, no pg-boss). This change writes the walking skeleton: the one app container's foundational components (config, data layer, job runtime, logging) wired together and provably booting. It realizes ADR-0001 (in-process pg-boss on Postgres, two connection modes, graceful shutdown) and ADR-0004 (pg-boss reached through a thin facade). Dev runs against a local Postgres on `localhost:5433`; prod is managed Postgres (deferred).

## Goals / Non-Goals

**Goals:**
- A process that boots only with valid config, connects to Postgres, runs background jobs, logs structured, and drains on shutdown.
- The component seams the L2 named (the pg-boss facade; `lib/{config,db,jobs,log}`) exist as real modules with stable interfaces, so features plug in without re-deciding infrastructure.
- `package.json` matches ADR-0001.

**Non-Goals:**
- Domain entities/schema (arrive with features), the CQRS mediator, the `EmailSender` stub, deployment topology, auth (D1).
- The D4 connector/EnrichmentProvider/LLMProvider ports - they arrive with the features that use them; this change only stands up the runtime they will run on.

## Decisions

- **Layout: `src/lib/<concern>` modules + `instrumentation.ts` at the root.** `lib/config` (env), `lib/db` (Drizzle client + schema), `lib/jobs` (pg-boss facade + handlers), `lib/log` (pino). Alternative - a flat `src/` - rejected; the L2 seams deserve named homes so features import a stable surface, not ad-hoc files.
- **Postgres driver: node-postgres (`pg`) for Drizzle's pooled app connection.** pg-boss already uses `pg` internally, so the tree has one pg-protocol library. Alternative - `postgres.js` - leaner/faster but adds a second pg lib alongside pg-boss's; single-driver consistency wins for the backbone.
- **Two pools, by design (ADR-0001).** Drizzle owns a pooled `pg.Pool` for app queries; pg-boss owns its own long-lived pool for polling/cron/maintenance. Both are sized via `max` and budgeted against the database's connection cap. They are separate because pg-boss manages its own pool lifecycle.
- **pg-boss behind a thin facade (ADR-0004), not a swap seam.** `lib/jobs` exposes a small surface (`enqueue`, `schedule`/cron, `work`/register-handler, the lifecycle `start`/`stop`) wrapping the pg-boss instance, for testability and one call site - explicitly not a portability layer (transactional enqueue stays Postgres-coupled).
- **Bootstrap in `instrumentation.ts` `register()`** (ADR-0001): start pg-boss and register handlers in the `nodejs` runtime only; idempotent so it survives the per-instance `register()` contract. The exact Next 16 register API + runtime guard will be taken from `node_modules/next/dist/docs/` (AGENTS.md), not assumed.
- **Config: Zod-validated env, fail-fast at boot, `server-only`.** A single `lib/config/env.ts` parses `process.env` once and throws on missing/invalid; nothing reads `process.env` directly elsewhere. `.env.example` documents every var (dev points at `localhost:5433`); real `.env` is gitignored.
- **Migrations are an explicit step, not auto-on-boot.** `drizzle-kit generate` + a `db:migrate` script; booting does not silently migrate (deterministic boot, multi-instance-safe). pg-boss creates its own `pgboss` schema on `start()`, so no migration models it.
- **Graceful shutdown is owned but best-effort (ADR-0001).** A SIGTERM/SIGINT handler calls `boss.stop({ graceful: true })`; because Next may `process.exit()` before a `register()`-added handler drains, the primary durability guarantee is idempotent jobs, with `NEXT_MANUAL_SIG_HANDLE` set if we need to own the signal fully.
- **Walking-skeleton proof.** A health route (`/api/health` or an RSC probe) that checks the DB; a registered no-op cron job that logs each tick (proves the worker runs); Vitest tests against the local Postgres for env-validation failure, DB connectivity, and one enqueue->process->complete round-trip.

## Risks / Trade-offs

- [Next 16 `register()` shutdown timing is best-effort] -> lean on job idempotency as the primary guarantee; set `NEXT_MANUAL_SIG_HANDLE` only if drain proves unreliable. (ADR-0001 already accepts this.)
- [Two pools can exhaust the connection cap, especially on serverless tiers] -> set each pool's `max` explicitly and budget against the cap; document the sum in `.env.example`.
- [pg-boss needs CREATE-SCHEMA privilege to build its `pgboss` schema] -> fine on local + most managed tiers; note it as a provisioning requirement for the deferred deployment slice.
- [Tests touch a real local Postgres (localhost:5433)] -> tests are gated on a `TEST_DATABASE_URL`; they skip (not fail) when no DB is configured, so CI without a DB stays green until a CI Postgres is added.

## Migration Plan

1. Reconcile deps (remove sqlite; add `pg`, `@types/pg`, `pg-boss`).
2. Add `lib/config`, `lib/log`, `lib/db` (+ `drizzle.config.ts`), `lib/jobs`, `instrumentation.ts`.
3. `drizzle-kit generate` an initial migration; `db:migrate` against local `localhost:5433`.
4. Boot (`next dev`), confirm: env validates, DB connects, pg-boss starts, the cron job ticks, logs are structured, SIGTERM drains.
5. Rollback: this is additive scaffolding on a fresh repo - revert the change; no data migration to undo (the initial migration is empty of domain tables).

## Open Questions

- Where prod migrations run (release step vs entrypoint) - deferred to the deployment slice; dev uses the explicit `db:migrate` script.
- Health-check surface (route handler vs RSC) - settle during implementation against the Next 16 docs.
