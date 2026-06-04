## Context

Background work runs as in-process pg-boss jobs reached through the `src/lib/jobs` facade (ADR-0001 in-process runtime, ADR-0004 thin facade). Queues are created at boot in `bootstrapNodeRuntime`: `heartbeat`, `source-scan`, `qualify`, `qualify-prospect`, `enrich`, `draft`. Today nothing surfaces their state - a triggered scan either silently works or throws into the dev overlay (the recent "Database not opened" failure was only visible because it crashed a Server Action).

pg-boss already exposes everything this view needs through public methods (verified against the installed `pg-boss` source, not just types):
- `getQueues()` -> `QueueResult[]` with `activeCount`, `queuedCount`, `deferredCount`, `totalCount`, `name`, `policy`, `createdOn`, `updatedOn`. One aggregated query; covers the per-queue counts.
- `getWipData({ includeInternal: true })` -> `WipData[]`, an IN-MEMORY snapshot of this process's worker objects (no SQL): per worker `name`, `state`, `count` (jobs in flight now), `lastJobStartedOn`, `lastJobDuration`, `lastError`, `lastErrorOn`. This is the true "running right now" view and the realtime liveness/last-error source.
- `findJobs(name, { queued: true })` -> `JobWithMetadata[]` for the WAITING jobs only (the SQL filters `state < active`, i.e. `created` + `retry`), bounded by the actual backlog. Carries `retryCount`, `createdOn`, `startedOn`, `state`.
- `getSchedules()` -> `Schedule[]` with `name`, `cron`, `timezone`.

Important: `findJobs` has no SQL `LIMIT` and no failed-state filter, so a bare `findJobs(name)` would pull the full retained job history (a real problem for the once-a-minute `heartbeat` queue). The read-model therefore NEVER calls unfiltered `findJobs`. No `pgboss.*` tables are read directly and no new dependency is added.

`getWipData()` reads the worker objects held in THIS process. It returns the registered workers only because the boss singleton is now pinned to `globalThis` (the recent fix): the route handler and the bootstrap that registered the workers resolve to the same instance. Without that fix `getWipData()` would be empty.

## Goals / Non-Goals

**Goals:**
- A wired `/jobs` view showing per-queue active/queued/deferred counts, the individual in-flight jobs, recently failed jobs with their cause, and the registered cron schedules.
- Live status via lightweight client polling, with a server-rendered initial snapshot (no loading flash).
- All reads go through a read-model added to the existing jobs facade; the view never touches raw pg-boss or the `pgboss` schema.
- Degrade gracefully when the job runtime is not started, rather than crashing the page.

**Non-Goals:**
- Any mutation (cancel / retry / delete / pause). Deferred to a later change.
- SSE / WebSockets / any worker-to-browser push. Polling only.
- Historical or archived-job analytics, throughput charts, per-job drill-in pages.
- Authentication / authorization (D1 single-user MVP; insertion point noted below).

## Decisions

### Read-model on the jobs facade (`src/lib/jobs`)
Add `server-only` read functions to `src/lib/jobs/index.ts`:
- `listJobActivity()` - composes one snapshot per queue from three cheap sources: `getQueues()` for the counts; `getWipData({ includeInternal: true })` for what each queue's worker is actively running now plus its last error (in-memory, no SQL); and `findJobs(name, { queued: true })` for the individual WAITING jobs (created + retry, with retry counts). It joins these by queue name. Returns a discriminated result: `{ status: "ok", queues, ... }` or `{ status: "unavailable", reason }`.
- `listSchedules()` - wraps `getBoss().getSchedules()` into a plain DTO; same `unavailable` degradation.

Queue names come from `getQueues()` (returned dynamically), not hardcoded, so the monitor stays correct as queues are added or renamed. The read-model never calls unfiltered `findJobs`, so it never pages retained history.

Failed-job surfacing: the most recent failure per queue comes from `getWipData()` (`lastError` / `lastErrorOn`), and retrying jobs appear in the `findJobs({ queued: true })` set (retry is `< active`). A full historical list of every failed job is a non-goal (no historical analytics), so we deliberately do not scan for terminal `failed` rows.

Module split (three files in `src/lib/jobs/`): `index.ts` is the `server-only` pg-boss I/O (coverage-excluded delegation); `activity-map.ts` holds the pure raw -> DTO mappers (runtime, server-side, coverage-included, unit-tested); `activity.ts` holds the DTO types ONLY (no runtime). The client poller imports types from `activity.ts`, so a client value-import of mapper logic is structurally impossible, not merely discouraged - the type/runtime boundary is enforced by file, not by comment.

Waiting-row cap: `findJobs` has no SQL `LIMIT`, so the mapper caps the individual waiting rows per queue (`MAX_WAITING_PER_QUEUE = 50`) in memory and carries the true backlog in `waitingTotal` (the DTO drops the job payload entirely, so no prospect data crosses to the browser regardless). This bounds the transmitted payload exactly when a queue backs up - the case the monitor exists to catch. The DB->server fetch of the waiting set is still unbounded (a pg-boss API limit), accepted at single-user MVP volume where the waiting backlog is small; the aggregate counts from `getQueues()` stay exact.

_Alternative considered:_ query the `pgboss.job` table via Drizzle for a richer failed-job history. Rejected - it bypasses the facade (ADR-0004), couples the view to pg-boss's internal schema, and a full failure history is out of scope for this read-only slice.

### Polling via a Route Handler, server-rendered first paint
- `GET /api/jobs/activity` (Route Handler, mirrors the existing `src/app/api/health/route.ts`) returns the read-model as JSON, marked non-cached / dynamic so each poll is fresh.
- The `/jobs` page is a Server Component that calls the facade read-model once and passes the snapshot as `initialData` to a single small `'use client'` poller. The poller re-fetches `/api/jobs/activity` on an interval (default ~3-4s) and re-renders. It pauses polling when the tab is hidden (`visibilitychange`) to avoid background churn.

_'use client' reason:_ an interval timer plus fetch-and-re-render is inherently client state; this is the one justified client component in the feature. Everything else (page, layout, cards) is a Server Component.

_Alternative considered:_ poll by calling `router.refresh()` against the RSC, or a Server Action on an interval. Rejected - re-rendering the whole server tree each tick is heavier than a small JSON endpoint, and Server Actions are POST/mutation-shaped, an awkward fit for a read poll. The Route Handler matches the established `api/health` read pattern.

### Graceful "runtime unavailable" state
If the job runtime is not started, the pg-boss calls throw (`Database not opened`). The read-model catches that class of error and returns a structured `unavailable` result; the Route Handler returns it with a normal status and the UI renders a "background runtime not running" panel instead of a 500. This directly covers the failure mode we just hit, and keeps the monitor itself from being the thing that breaks.

### UI placement: Operations section, not an anchor view
The monitor is observability, not a high-judgment surface, so per the architectural thesis it is NOT one of the three anchor views. The wired sidebar (`src/app/(app)/layout.tsx`) gains a separate "Operations" section linking to `/jobs`, reusing the existing `NavLink` component (which already handles active-state highlighting). Friendly queue labels (e.g. `source-scan` -> "Source scan") live in the view, not the facade.

## Risks / Trade-offs

- **Per-poll query cost** -> Cheap by construction: one `getQueues()`, one in-memory `getWipData()`, and a per-queue `findJobs({ queued: true })` bounded by real backlog (not history). Interval >= ~3s, polling paused on hidden tab. Single-user MVP load is negligible.
- **`findJobs` has no LIMIT and unfiltered pulls retained history** -> The read-model only ever calls `findJobs(name, { queued: true })` (SQL `state < active`), so it returns waiting jobs only and never the completed `heartbeat` backlog.
- **`getWipData()` is empty if workers were registered on a different boss instance** -> Resolved by the `globalThis` singleton fix; the route handler and bootstrap share one instance. Noted here because the feature depends on it.
- **Peel-safety tension with ADR-0001 (NEEDS AN ADR / human sign-off)** -> ADR-0001's peel-safety invariant requires the web and worker roles to share state "solely through Postgres - no module-level mutable singletons, no in-process caches". Two parts of this feature touch that invariant: (1) the `globalThis`-pinned pg-boss singleton (introduced by the cross-context bug fix) is a process-level mutable singleton; (2) the liveness view reads `getWipData()`, an IN-PROCESS worker-memory snapshot, not Postgres. Consequence: after the worker is peeled into a standalone `worker.ts` (ADR-0001's primary scaling lever), the web tier has no in-process workers, so `getWipData()` returns empty and the liveness portion of the monitor degrades to the Postgres-backed counts/waiting-rows (which stay correct). This is a bounded, gracefully-degrading exception, recorded in **ADR-0011 (status: proposed)** with its provenance note `docs/explore/2026-06-04-jobs-monitor-peel-safety.md`. ADR-0011 needs human sign-off (flip to accepted) before archive - the agent must not self-accept it. The counts/schedules/waiting-jobs paths (`getQueues`/`findJobs`/`getSchedules`) are Postgres-backed and remain peel-safe.
- **pg-boss API drift across versions** -> Only documented public methods are used, verified against the installed `pg-boss` type definitions, behind the facade so any future change is localized to one module.
- **Job payloads can reference prospect data (PII)** -> The read endpoint is unauthenticated for the single-user MVP (D1), the same deferral already acknowledged in `icp-config/actions.ts`. The Route Handler is the single, documented insertion point for authorization at the productization milestone; the design records this rather than leaving it implicit.
- **Polling shows near-real-time, not instant** -> Acceptable for an operational monitor; the spec requires "within a few seconds", which polling meets.

## Migration Plan

Additive only - no schema change, no migration, no new dependency. Ships behind the existing app shell; rollback is removing the route, the facade read functions, and the nav entry. No data to back out.

## Open Questions

- ~~Exact poll interval and per-queue job `limit`~~ RESOLVED: poll ~3.5s; waiting rows capped at `MAX_WAITING_PER_QUEUE = 50` with `waitingTotal` surfacing the true backlog.
- The peel-safety exception is recorded as new ADR-0011 (status: proposed); it awaits human sign-off (flip to accepted) before archive.
- Whether to add a wireframe screen under `src/app/prototype/` for the monitor or graduate directly. Default: build the wired view directly (observability view, low layout ambiguity) and update the prototype README registry to record the new wired screen; revisit if the layout proves non-obvious.
