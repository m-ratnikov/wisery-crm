# Explore: Background job runtime

- Date: 2026-05-20
- Decision: [ADR-0001](../adr/0001-background-job-runtime.md) (accepted)
- Method: spec-kit (clarify + research), adapted

## Question

Where and how do background jobs run (signal scans, qualification, enrichment, rate-limited sends), and on what datastore?

## Assumptions and constraints

- Primary datastore: managed Postgres (Neon/Supabase/RDS). SQLite dropped.
- Worker model: both in-process hosted lifecycle (ASP.NET Core BackgroundService feel) and batteries-included durability/retries/scheduling (Hangfire feel).
- App runs as a persistent self-hosted Node process (Next.js 16 `next start` + systemd on the VPS).
- No Redis. KISS. Grounded in installed Next.js docs per AGENTS.md.

## Clarifications

- Q: Postgres primary or just the job queue? -> Primary store, drop SQLite.
- Q: ".NET background tasks" - in-process hosted, durable framework, or both? -> Both.
- Q: Postgres hosting? -> Managed (Neon/Supabase/RDS).

## Unknowns

- NC1 - In-process vs separate worker, given Postgres (vs the old SQLite single-writer constraint).
- NC2 - Which Postgres-backed job library gives the Hangfire feel (durable, retries, cron, dashboard).
- NC3 - How to start an in-process worker under Next.js 16.
- NC4 - Managed-Postgres connection model (pooling, LISTEN/NOTIFY).
- NC5 - Path to move the worker out of the web process later.

## Options considered

### Job library

- pg-boss (CHOSEN) - Postgres-backed, SKIP LOCKED, retries + dead-letter, cron, and a web dashboard (`@pg-boss/dashboard`). Closest "Hangfire feel." Embeddable in-process.
- Graphile Worker - faster (<3ms latency, ~11.8k jobs/s), SKIP LOCKED, cron, retries; no official dashboard. Alternative if throughput beats feature breadth.
- BullMQ - Redis-backed; only worth it for tens of thousands of jobs/s. Adds Redis. Rejected.
- Hand-rolled queue - rejected; reinvents retries/cron/locking pg-boss already provides.

### Where the worker runs

- In-process via `instrumentation.ts register()` (CHOSEN) - `await boss.start()` + register handlers on boot; pg-boss then runs via its own timers/LISTEN, so it satisfies "register must complete before serving." BackgroundService-style lifecycle. Starvation guard: the pipeline is I/O-bound, so the event loop stays free at MVP volume; CPU-bound steps (e.g. HTML parsing) run on a `worker_threads` pool, and the worker peels into a separate process if request latency degrades.
- Separate worker process - the same pg-boss code can run standalone later if the web event loop gets starved; Postgres SKIP LOCKED makes concurrent workers safe. Kept as the escape hatch, not the default.

## Key findings

- Postgres `SKIP LOCKED` gives safe concurrent claiming, so multiple workers are fine. This removes the single-writer objection that forced a separate process under SQLite, and unlocks the in-process model.
- pg-boss (12.x, May 2026): retries + dead-letter, cron, dashboard, `@pg-boss/proxy` for pooling.
- Drivers: a persistent self-hosted Node process should use a standard TCP driver (`pg` / `postgres.js`) with pooling, not the Neon serverless driver. Drizzle supports the Postgres dialect.
- Caveat: pg-boss/Graphile Worker use LISTEN/NOTIFY, which needs a session-mode (direct) connection. With Neon's PgBouncer (transaction mode), point pg-boss at the direct/unpooled endpoint (or `@pg-boss/proxy`) and use the pooled endpoint for app queries.

## Outcome

Managed Postgres as the primary store (Drizzle), with pg-boss embedded in-process via `instrumentation.ts` for durable, retrying, scheduled jobs; peelable into a standalone worker later. Recorded in ADR-0001.

## Deferred

- Provider pick (Neon vs Supabase vs RDS) - its own decision; changes only the pooling specifics (Neon PgBouncer transaction mode, Supabase Supavisor, RDS Proxy).
- Graceful shutdown: `boss.stop()` on SIGTERM to drain in-flight jobs - design/tasks detail, not architectural.
- pg-boss owns its `pgboss` schema and runs its own migrations on `start()`; keep it out of Drizzle's migration scope, and ensure the DB role can create the schema - design/tasks detail.

## Sources

- Installed Next.js 16 docs: `instrumentation.md`, `after.md`.
- [timgit/pg-boss](https://github.com/timgit/pg-boss); [graphile/worker](https://github.com/graphile/worker); pg-boss tutorial 2026 (Nerd Level Tech).
- [Neon connection pooling](https://neon.com/docs/connect/connection-pooling); pg vs postgres.js vs Neon serverless driver (2026).
