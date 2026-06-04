# Jobs monitor vs the ADR-0001 peel-safety invariant

- Date: 2026-06-04
- Context: the `job-activity-monitor` change (read-only background-jobs monitor at `/jobs`)
- Trigger: code-review (canon lens) flagged a tension with ADR-0001's peel-safety invariant
- Outcome: ADR-0011 (proposed)

## Question

The monitor's live view needs to show what each queue is running right now (in-flight
count, when the running work started, the worker's last error). What is the cheapest correct
source for that, and does it conflict with ADR-0001?

## What pg-boss exposes (verified against the installed source, not training data)

- `getQueues()` -> per-queue `activeCount` / `queuedCount` / `deferredCount` / `totalCount`. One
  aggregated SQL query. Postgres-backed.
- `findJobs(name, { queued: true })` -> the waiting jobs only (the generated SQL filters
  `state < 'active'`, i.e. `created` + `retry`). No SQL `LIMIT` and no failed-state filter.
  Postgres-backed.
- `getSchedules()` -> the cron schedules. Postgres-backed.
- `getWipData({ includeInternal: true })` -> an IN-MEMORY snapshot of the current process's
  worker objects (no SQL): per worker `state`, `count` (in flight now), `lastJobStartedOn`,
  `lastJobDuration`, `lastError`, `lastErrorOn`.

Only `getWipData()` gives per-queue "running now + liveness + last error" cheaply. The alternative
- listing individual `active` rows - is not available: `findJobs` has no active-only filter, so it
would mean an unfiltered `findJobs(name)` that pages the full retained job history (catastrophic for
the once-a-minute `heartbeat` queue). So `getWipData()` is the only cheap liveness source.

## The tension

ADR-0001's peel-safety invariant: the web and worker roles must share state "solely through
Postgres - no module-level mutable singletons, no in-process caches or event buses". Two parts of
the monitor touch it:

1. `getWipData()` reads in-process worker memory, not Postgres.
2. `getBoss()` is pinned to `globalThis` (a cross-module-context bug fix: Next's `instrumentation`
   and Server Actions/route handlers were resolving to separate module instances, so the boss the
   workers were registered on was not the boss a Server Action saw - "Database not opened"). A
   `globalThis` slot is a process-level mutable singleton. It is also WHY `getWipData()` sees the
   workers at all (same instance as bootstrap).

## Options considered

- A. Accept a bounded exception, recorded in an ADR. Liveness is in-process and best-effort; after
  the worker is peeled into a standalone process, `getWipData()` in the web tier returns empty and
  the liveness view degrades to the Postgres-backed counts/waiting/schedules (which stay correct).
  Cheapest; honest about the peel consequence. CHOSEN (ADR-0011, proposed).
- B. Strictly peel-safe: derive "running" only from `getQueues().activeCount` (Postgres), drop the
  liveness detail (running-since, last error). Needs no ADR but loses the realtime status the
  feature was asked for.
- C. Query the `pgboss.job` table directly for active rows with a SQL `LIMIT`. Rejected: bypasses
  the facade (ADR-0004) and couples the monitor to pg-boss's internal schema.

## Decision

Option A. The counts, waiting jobs, and schedules stay Postgres-backed and peel-safe; the liveness
view is an explicitly bounded, gracefully-degrading in-process exception. Recorded in ADR-0011.
