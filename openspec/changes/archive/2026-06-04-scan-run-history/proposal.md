## Why

The background-jobs monitor (`/jobs`) shows only live queue state - what is running or queued at this instant. A source scan finishes in well under a second, so by the time the CRM user looks, the queue is idle again and the page records nothing about what the run did. The user's real question, "I ran a scan but the queue is empty - why?", has no answer on the page, even though the `scans` table already stores every run's outcome (fetched, persisted, dropped, status, error). Two presentation problems compound it: pg-boss's internal `__pgboss__send-it` queue is shown as if it were a user queue, and the cards read as raw engineering telemetry (`0 active / 0 queued / 0 deferred`, `worker active - last run 06:33:58 UTC (1 ms)`).

## What Changes

- **Add a "Recent scans" section to the jobs monitor** that reads recent rows from the existing `scans` table (joined to `sources` for a readable label) and shows each run's outcome in plain language - for example "fetched 12, 0 new, 12 already seen", "fetched 0, nothing matched", or the recorded error for a failed run. This is what answers "why is the queue empty after my scan". It refreshes on the same poll as the live queue view.
- **Exclude internal pg-boss queues from the monitor display.** Any `__pgboss__*` queue (the engine's own cron/timekeeper queue) is filtered out of the user-facing queue list. The internal liveness use of `getWipData({ includeInternal: true })` is unaffected; only what the user sees is filtered.
- **Humanize the queue cards** (presentation): a plain one-line description of what each queue does and a human status (Idle / Running / Last ran N ago) in place of the active/queued/deferred jargon and the duplicated raw queue name.

Scans are the only stage with a durable per-run record. Qualify, enrich, and draft have no run-history table, so they are explicitly out of scope here - their cards keep showing live state only.

## Capabilities

### New Capabilities
- `scan-run-history`: surfacing recorded scan-run outcomes in the jobs monitor - a read-model over `scans` + `sources` that turns each run's counts and status into a plain-language recent-runs view, refreshed on the monitor's poll. This is read-only and additive; it does not change how scans are recorded (that stays owned by `signal-ingestion`).

### Modified Capabilities
- `job-activity-monitor`: the displayed queue set excludes pg-boss internal (`__pgboss__*`) queues. (This capability is defined by the in-flight `job-activity-monitor` change, which must archive before this one.)

## Impact

- **UI**: `src/app/(app)/jobs/_components/JobsMonitor.tsx` (recent-scans section, humanized cards, internal-queue filter), `src/app/(app)/jobs/page.tsx` (compose the scan-history read-model into `initialData`), `src/app/api/jobs/activity/route.ts` (include scan history in the polled payload).
- **New read-model** (separate from the pg-boss facade): a scan-history reader in `src/lib/signals` that uses the app's Drizzle pool (`src/lib/db`) to read `scans` joined to `sources`, plus a pure mapper from rows to plain-language DTOs. DTO types extend the client-safe `JobsMonitorData` shape in `src/lib/jobs/activity.ts`.
- **Architecture decision (ADR)**: ADR-0011 (proposed) scoped the jobs monitor to pg-boss-only introspection for peel-safety. Reading the domain `scans` table is a deliberate, separate domain read-model composed into the same page - it lives outside `src/lib/jobs` (which stays pg-boss-only) and uses the normal web-tier Drizzle pool. This boundary needs an ADR that relates to ADR-0011.
- **No schema change, no migration**: the `scans` table and its counts already exist (`signal-ingestion`).
- **Process dependency**: this change modifies the `job-activity-monitor` capability, whose change is unarchived pending ADR-0011 sign-off; that change archives first.
