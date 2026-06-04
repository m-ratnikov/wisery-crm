## Context

The jobs monitor (`/jobs`) is a read-only observability surface over the in-process pg-boss pipeline. Its read-model lives entirely in `src/lib/jobs` and reads pg-boss only: `getQueues`, `findJobs(queued:true)`, `getSchedules` (Postgres-backed) plus `getWipData` (in-memory liveness). ADR-0011 (proposed) deliberately scoped the monitor to that pg-boss surface and recorded the `getWipData`/`globalThis` use as a bounded, gracefully-degrading exception to ADR-0001's peel-safety invariant.

That scope is exactly why the monitor cannot answer "I ran a scan but the queue is empty - why?". A scan completes in well under a second; the only durable record of what it did is the domain `scans` table (`signal-ingestion`), which the monitor does not read. This change surfaces that record. It also removes pg-boss's internal `__pgboss__send-it` queue from the display and replaces the engineering-telemetry card copy with plain language.

Constraints honored: Server Components by default (ADR-aligned), `server-only` on any module that must not reach the client bundle, ISO-string timestamps end to end (the existing hydration-safe convention in `activity.ts`), no em-dashes in user-facing copy, reuse before build.

## Goals / Non-Goals

**Goals:**
- Surface recorded scan-run outcomes on `/jobs` in plain language, refreshed on the existing poll.
- Hide pg-boss internal (`__pgboss__*`) queues from the user-facing list without changing how liveness is collected.
- Replace the jargon card copy with a one-line queue description and a human status.
- Keep `src/lib/jobs` pg-boss-only; introduce the scan-history read as a separate domain read-model.

**Non-Goals:**
- Run history for qualify/enrich/draft. They have no per-run record; adding one is a separate change with a new table and a write on the hot path (the larger option deliberately deferred).
- Any schema change or migration. The `scans` table and its counts already exist.
- Any mutation control (re-run, delete, cancel). The monitor stays read-only.
- Splitting "dropped" into validation-drops vs dedup-drops. The schema records a single `droppedCount`; the summary infers "already seen" from `fetched > 0 && persisted = 0 && dropped > 0` without claiming a precise per-reason breakdown.

## Decisions

### D1: A separate domain read-model in `src/lib/signals`, not an extension of the jobs facade

The scan-history read lives in `src/lib/signals`, reading `scans` joined to `sources` through the app's Drizzle pool (`src/lib/db`). `src/lib/jobs` stays pg-boss-only. The `/jobs` page and the `/api/jobs/activity` route compose the two read-models side by side (the app layer is the composition point, and `lib-not-to-app` already forbids the reverse direction).

Three modules, mirroring the existing `activity.ts` / `activity-map.ts` / `index.ts` split exactly:
- `src/lib/signals/scan-history-view.ts` - **types only** (client-safe, no runtime): `ScanRunView`, `ScanHistorySnapshot` (discriminated `ok` | `unavailable`, like `JobActivitySnapshot`). Mirror of `activity.ts`.
- `src/lib/signals/scan-history-map.ts` - **pure mappers** (runtime, server-side, coverage-included, unit-tested): row -> `ScanRunView` and the plain-language summary derivation. Mirror of `activity-map.ts`.
- `src/lib/signals/scan-history.ts` - **server-only** Drizzle reader `listScanHistory(limit)`: `scans` join `sources`, order by `startedAt` desc, `LIMIT`, guarded with the same degrade-to-`unavailable` try/catch as `listJobActivity`. Mirror of `index.ts`'s I/O half.

*Alternative rejected:* fold the scans read into `listJobActivity` in `src/lib/jobs`. That drags the Drizzle pool and domain schema into the module ADR-0011 keeps pg-boss-only, couples the facade to `signal-ingestion`, and would mean a single try/catch conflates "pg-boss runtime down" with "scans query failed". Keeping them separate lets each degrade independently.

### D2: Boundary and peel-safety - this read is ordinary web-tier data access (ADR-0012, proposed)

Reading `scans` via the Drizzle pool on the web tier is normal request-scoped data access, not the kind of state-sharing ADR-0001's peel-safety invariant restricts (no module-level mutable singleton, no in-process cache of business state, no request/job-spanning transaction). It is in fact *more* peel-safe than the existing liveness line: after a web/worker peel the web tier still owns the Drizzle pool and the `scans` table, so scan history keeps working where `getWipData` liveness goes empty.

This is recorded as **ADR-0012 (proposed, relates to ADR-0011)**: the jobs monitor *page* composes pg-boss introspection (`src/lib/jobs`) and domain read-models (`src/lib/signals`) side by side; `src/lib/jobs` stays pg-boss-only; domain run-history is surfaced through the normal Drizzle web-tier read path. ADR-0012 is left **proposed** for human sign-off; per project convention the agent does not self-accept an ADR, and apply/archive of this change is gated on that sign-off (as the in-flight `job-activity-monitor` change is gated on ADR-0011).

### D3: Composite wire shape via a types-only seam

`JobsMonitorData` in `src/lib/jobs/activity.ts` gains `scanHistory: ScanHistorySnapshot`, importing the type from `scan-history-view.ts`. This is a **types-only** import (no runtime, no `server-only`, no Drizzle): it cannot pull a runtime dependency across the boundary, so the runtime separation D1/D2 protect is intact. `JobsMonitorData` is already defined as "the shape returned by GET /api/jobs/activity and rendered by the monitor", so growing it to carry the page's third read-model keeps one wire type for the page, the route, and the client poller. dependency-cruiser has no rule against a types-only `jobs -> signals` edge; the rule that matters (FF-4, `pipeline-not-to-jobs`) is unaffected because the reader is not a pipeline core.

*Alternative considered:* a new app-layer composite type so `activity.ts` stays untouched. Rejected as more churn (a third imported type in page, route, and component) for no runtime-boundary gain over the types-only seam.

### D4: Plain-language summary derivation, in the pure mapper

The summary is derived from `status` + the three counts, all in `scan-history-map.ts` (so it is unit-tested without a DB):
- `failed` -> the recorded `error` (or a generic fallback if null).
- `running` -> "in progress".
- `completed` and `fetched = 0` -> "nothing matched".
- `completed` and `persisted > 0` -> "fetched N, M new" (and "K already seen" when `dropped > 0`).
- `completed` and `fetched > 0` and `persisted = 0` -> "fetched N, no new signals, all already seen".

Counts are rendered as data; the phrasing lives in one place so the spec scenarios map one-to-one to mapper test cases.

### D5: Refresh on the existing poll; bounded history

The `/api/jobs/activity` route adds `scanHistory` to its payload, so the existing 3.5s poll in `JobsMonitor.tsx` refreshes scans with no new client mechanism (reuse of the poller seam). `listScanHistory` takes a small `LIMIT` (e.g. 20, most-recent-first) so the payload and query stay bounded as history grows.

### D6: Coverage

`scan-history-map.ts` is pure and unit-tested (satisfies per-file coverage, mirroring `activity-map.ts`). `scan-history.ts` carries real query logic (join, order, limit), so it is covered by an integration test that seeds `sources` + `scans` and asserts ordering, the limit, and the mapped shape - the `src/lib/queue/read.ts` precedent (DB reads are integration-tested, not added to the coverage exclude list). `scan-history.ts` is therefore NOT added to `vitest.config.ts`'s exclude block.

## Risks / Trade-offs

- **Types-only `jobs -> signals` seam (D3)** -> The risk is a future edit turning it into a runtime import. Mitigation: `scan-history-view.ts` is types-only by construction (no executable lines, like `activity.ts`); the runtime reader is a different module. If a build-enforceable guard is wanted later, a dependency-cruiser rule forbidding a runtime `jobs -> signals` edge can be added, tracked as future work, not added here.
- **Two independent `unavailable` paths (jobs vs scans)** -> The page can show live queues fine while scan history is unavailable, or vice versa. This is intended (independent degradation) but the UI must render each section's `unavailable` state on its own rather than failing the whole page.
- **"already seen" is inferred, not precise (Non-Goals)** -> `droppedCount` merges dedup-drops and validation-drops. The summary says "already seen" when `fetched > 0 && persisted = 0 && dropped > 0`, which is the common case but not a guarantee every drop was a duplicate. Acceptable for an observability surface; a precise breakdown would need a schema change (out of scope).
- **ADR-0012 is proposed, not accepted** -> Apply/archive is gated on human sign-off, and this change also sits behind the `job-activity-monitor` change archiving first (it modifies that capability). If ADR-0012 is rejected, D1-D3 are revisited before any code lands.
