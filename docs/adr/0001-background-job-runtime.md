# ADR-0001: Background jobs run in-process via pg-boss on managed Postgres

- Status: accepted
- Date: 2026-05-20
- Corrected: 2026-05-22 (factual fix + dashboard dropped; see Correction)
- Supersedes: none

## Correction (2026-05-22)

Corrected after the C4 L2 architecture review (change `c4-level2-architecture`), by explicit exception to the usual ADR immutability rule. The accepted decision is unchanged - pg-boss in-process on managed Postgres. The fixes:

1. pg-boss claims jobs by long-polling with `SKIP LOCKED`; it does not use `LISTEN/NOTIFY` (it has none). The need to give pg-boss a direct connection is real, but the reason is that pg-boss manages its own long-lived connection pool - not `LISTEN/NOTIFY`, and not advisory-lock breakage (its advisory locks are transaction-scoped via `pg_advisory_xact_lock`, which release at commit and are pooler-safe).
2. The `@pg-boss/dashboard` is dropped from scope. We need durable background execution and dead-letter visibility, not a job UI; the dashboard is also a standalone unauthenticated server, not in-process middleware.

Shutdown ownership, the connection budget, the multi-instance footprint, and the peel-safety invariant are made explicit in Decision and Consequences below.

## Context

The pipeline (signal scans, qualification, enrichment, rate-limited sends) is asynchronous background work. The primary datastore is managed Postgres (Neon/Supabase/RDS); SQLite is not used. The app runs as a persistent self-hosted Node process (Next.js 16 `next start` + systemd). We want a worker that is both in-process and host-managed (ASP.NET Core BackgroundService feel) and batteries-included - durable, with retries and scheduling (Hangfire feel, minus the job UI). No Redis. Postgres `SKIP LOCKED` makes concurrent job claiming safe, so an in-process worker is viable even with multiple server instances.

Investigation and rejected alternatives: [docs/explore/2026-05-20-background-job-runtime.md](../explore/2026-05-20-background-job-runtime.md).

## Decision

Use **pg-boss** (a Postgres-backed durable job queue) for background jobs, started **in-process** from Next.js `instrumentation.ts` - `register()` awaits `boss.start()` and registers handlers in the `nodejs` runtime. pg-boss provides retries with a dead-letter queue and cron scheduling; jobs persist in the same managed Postgres reached via Drizzle.

pg-boss claims work by **long-polling with `SKIP LOCKED`** (not `LISTEN/NOTIFY`) and manages its **own long-lived `pg.Pool`** (`application_name='pgboss'`) for polling, cron, and maintenance; its singleton coordination uses transaction-scoped advisory locks (`pg_advisory_xact_lock`), which release at commit and are pooler-safe. Because pg-boss runs its own pool, give it a **direct connection** rather than fronting it with a transaction-mode pooler (PgBouncer/Supavisor) - a pooler in front of pg-boss's own pool is redundant and adds connection churn for no benefit. App queries, by contrast, go through the **pooled endpoint** via a standard TCP driver (`pg`/`postgres.js`).

We do **not** run the pg-boss dashboard. Durable background execution plus dead-letter visibility (pino logs and SQL views over the `pgboss` schema) is what we need; a job UI is out of scope.

Because the pipeline is I/O-bound (Apify, LLM, email APIs), jobs do not starve the event loop at expected volume. The **primary scaling lever** is the no-rewrite peel into a standalone `worker.ts` process; `worker_threads` is a **profile-driven optimization** for a specific step proven CPU-bound (e.g. HTML parsing or large-payload serialization), applied only after measurement - not an upfront promise.

## Consequences

- One datastore (Postgres) for app data and jobs; no Redis and no separate queue infrastructure. It is a single failure domain - a Postgres outage halts both serving and background work, accepted while single-user.
- The worker shares the web process's event loop. At single-user, I/O-bound volume this is safe; a synchronous CPU step can move to a `worker_threads` pool if profiling shows it. If request p95 degrades under job load, peel the worker into its own process (same code) - `SKIP LOCKED` keeps concurrent consumers safe.
- **Peel-safety invariant**: the peel stays a no-rewrite move only while the web and worker roles share state **solely through Postgres** - no module-level mutable singletons, no in-process caches or event buses, and no transaction or connection spanning a request handler and a job handler. This invariant governs L3 component design.
- **Graceful shutdown is owned, not assumed**: Next.js App Router has no built-in hook for stopping pg-boss, so `instrumentation.ts` registers a SIGTERM/SIGINT handler that calls `boss.stop({ graceful: true })` within the host stop window (systemd `TimeoutStopSec` 30-60s). Next 16 installs its own signal handlers and may `process.exit()` before a handler added in `register()` finishes draining (unless `NEXT_MANUAL_SIG_HANDLE` is set and the full shutdown is owned), so drain timing is best-effort. The **primary** durability guarantee is therefore idempotency: because a crash or restart re-runs in-flight jobs on retry, every externally-billed step (Apify, Anthropic) is **idempotent**.
- **Connection budget**: pg-boss holds its own persistent pool of direct connections; set its pool `max` explicitly and budget it against the database's connection cap (the smaller direct-connection cap on serverless tiers especially), alongside the pooled app connections. This is a sizing/configuration constraint, not a reason to disqualify a provider - pg-boss runs fine against managed Postgres given a direct connection for its pool.
- **Multi-instance footprint**: each `next start` instance that runs `register()` starts a full pg-boss engine (poller, cron, maintenance, its own pool). `SKIP LOCKED` keeps claiming correct, but horizontal web scaling multiplies pg-boss's connection footprint and polling load - past one instance, prefer peeling to a single standalone `worker.ts` (stateless web tier) over N embedded engines.
- The data layer becomes Postgres-specific (Drizzle Postgres dialect, `pg`/`postgres.js`), and the earlier file-per-tenant productization idea no longer applies - multi-tenancy becomes schema- or row-level. Updating `CLAUDE.md`, `architecture-overview.md`, and the M0 data-layer plan follows from accepting this.
