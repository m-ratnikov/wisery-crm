## Why

The outreach pipeline (scan -> qualify -> draft, with the enrich side-transition) runs as in-process pg-boss jobs, but operators have zero visibility into it. When a scan is triggered there is no way to see whether its job is running, queued, retrying, stuck, or dead-lettered - the only signal today is a thrown error in the dev overlay. A read-only monitor closes that blind spot.

## What Changes

- Add a wired observability route (`/jobs`) that shows background-job activity with live (polled) status:
  - **Running and queued work**: per pg-boss queue (`source-scan`, `qualify`, `qualify-prospect`, `enrich`, `draft`, `heartbeat`) the active / queued / deferred counts, plus the individual in-flight jobs with state, `startedOn`, `heartbeatOn` liveness, retry count, and the last failure output for failed jobs.
  - **Scheduled work**: the cron schedules (name, cron expression, timezone).
- Extend the existing `src/lib/jobs` facade (ADR-0004) with read-model functions that wrap pg-boss `getQueues()` / `findJobs()` / `getSchedules()`. No direct `pgboss.*` table access; no parallel job mechanism.
- Add an "Operations" (or "System") navigation section to the wired app shell for this view. It is an observability view, NOT a high-judgment anchor view, so it is deliberately kept out of the three anchor views.
- Live status is client-side polling of a read endpoint every few seconds. pg-boss cannot push to the browser and an SSE worker-to-browser bridge is out of scope; no new realtime infrastructure.
- Read-only in this slice. Cancel / retry / delete (which pg-boss supports) are explicitly deferred to a later change.

## Capabilities

### New Capabilities
- `job-activity-monitor`: A read-only operations view of background-job activity - currently running and queued jobs per queue with live status and failures, plus the registered cron schedules.

### Modified Capabilities
- `background-jobs`: The jobs facade gains a job-activity introspection read-model (queue counts, in-flight jobs, and schedules) exposed through the facade rather than the raw pg-boss instance. This is new spec-level behavior, not just an implementation detail.
- `app-shell`: The persistent navigation gains an operations/system section linking to the jobs monitor, distinct from the three anchor views.

## Impact

- New code: `src/app/(app)/jobs/` (Server Component page + one small `'use client'` poller), a read endpoint (route handler or server action) for the poll, read-model additions in `src/lib/jobs`.
- Modified code: `src/app/(app)/layout.tsx` (nav section), `src/app/prototype/README.md` (screen registry, if a screen is added/graduated).
- No schema changes, no migrations, no new dependencies (pg-boss already exposes every method used).
- Security: the read endpoint is unauthenticated for the single-user MVP (D1, the auth-deferred caveat noted in `icp-config/actions.ts`). Job payloads can contain prospect PII, so the spec marks where authorization must be added at the productization milestone.
