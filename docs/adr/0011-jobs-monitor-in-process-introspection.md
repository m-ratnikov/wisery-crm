# ADR-0011: Job-activity introspection reads in-process worker state (bounded peel-safety exception)

- Status: accepted
- Date: 2026-06-04
- Supersedes: none
- Source: docs/explore/2026-06-04-jobs-monitor-peel-safety.md; the `job-activity-monitor` change (design.md), raised by the canon code-review lens

## Context

The read-only jobs monitor (`job-activity-monitor`) shows what each background queue is doing now: per-queue counts, the individual waiting jobs, the cron schedules, and a liveness line (how many jobs are in flight, when the running work started, the worker's most recent error). Of the cheap pg-boss read methods, only `getWipData()` provides liveness, and it is an IN-MEMORY snapshot of the current process's worker objects, not a Postgres read. The other three (`getQueues()`, `findJobs(name, { queued: true })`, `getSchedules()`) are Postgres-backed. There is no cheap Postgres-backed way to list active jobs: `findJobs` has no active-only filter and no `LIMIT`, so an unfiltered scan would page the full retained history of the once-a-minute `heartbeat` queue.

Separately, `getBoss()` is now pinned to `globalThis`. This was a cross-module-context fix: Next 16's `instrumentation.ts` and Server Actions / route handlers can resolve to separate instances of the jobs module, so the boss instance that registered the workers was not the instance a Server Action enqueued on (the "Database not opened" failure). The `globalThis` slot makes one shared started instance, which is also why `getWipData()` in a route handler sees the bootstrap-registered workers.

ADR-0001's **peel-safety invariant** requires the web and worker roles to share state "solely through Postgres - no module-level mutable singletons, no in-process caches". Both the `getWipData()` liveness read and the `globalThis` singleton touch that clause. ADR-0001 is otherwise unchanged and in force; this ADR records a scoped exception rather than amending it.

## Decision

The jobs monitor's liveness view MAY read in-process worker state via the pg-boss facade's `getWipData()`, and the pg-boss engine MAY be held as a `globalThis`-pinned singleton, as a **bounded, gracefully-degrading exception** to ADR-0001's peel-safety invariant. The exception is scoped to the job-runtime engine and its observability, not to business-logic state: no domain state, request/job-spanning transaction, or in-process cache of business data is permitted to rely on it.

The monitor's other reads - per-queue counts (`getQueues`), waiting jobs (`findJobs queued:true`), and schedules (`getSchedules`) - stay Postgres-backed and fully peel-safe. The liveness portion is best-effort: after the worker is peeled into a standalone `worker.ts` (ADR-0001's primary scaling lever), the web tier runs no workers, so `getWipData()` returns empty and the liveness line disappears while the Postgres-backed counts/waiting/schedules remain correct. This degradation is acceptable for a single-user MVP observability surface and requires no rewrite of the monitor at peel time - only the loss of an enhancement.

## Consequences

- The monitor delivers the realtime "running now + last error" status the feature requires at the cheapest cost (one in-memory snapshot, no extra SQL), without bypassing the facade (ADR-0004) or reading `pgboss.*` tables directly.
- The peel-safety invariant keeps a single authoritative home in ADR-0001; this ADR narrows it by explicit exception for the engine singleton and its introspection, so a future reader does not mistake the `globalThis` pin or `getWipData()` use for a violation - or for license to add business-state singletons.
- The peel (web/worker split) stays a no-rewrite move: the monitor still renders, only the liveness line goes empty. If liveness-after-peel is later wanted, it must come through Postgres (e.g. reading active job rows with a bounded query), tracked as future work, not promised here.
- The `globalThis` singleton remains the supported way the in-process boss is shared across Next module contexts; removing it reintroduces the "Database not opened" class of bug. Scoped strictly to the pg-boss engine handle.
