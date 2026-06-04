# ADR-0012: The jobs monitor page composes domain read-models alongside pg-boss introspection

- Status: accepted
- Date: 2026-06-04
- Relates to: ADR-0011 (jobs-monitor in-process introspection), ADR-0001 (background-job runtime, peel-safety)
- Source: the `scan-run-history` change (design.md, decisions D1-D3), raised when surfacing scan-run outcomes on the monitor

## Context

The jobs monitor (`/jobs`) was built as a read-only view over the in-process pg-boss pipeline, and ADR-0011 deliberately scoped its read-model (`src/lib/jobs`) to pg-boss sources only: per-queue counts, waiting jobs, schedules, and an in-memory liveness snapshot. That scope is precisely why the monitor cannot answer "I ran a scan but the queue is empty - why?": a scan finishes in well under a second, and the only durable record of what it did is the domain `scans` table (`signal-ingestion`), which `src/lib/jobs` does not (and per ADR-0011 should not) read.

Surfacing that record means reading a domain table (`scans` joined to `sources`) through the app's Drizzle pool. The question is where that read lives and whether it touches ADR-0001's peel-safety invariant, which forbids the web and worker roles from sharing state through module-level mutable singletons or in-process caches of business state.

## Decision

Domain run-history shown on the jobs monitor is read through a **separate domain read-model**, not through the pg-boss facade. `src/lib/jobs` stays pg-boss-only. The scan-history read-model lives in `src/lib/signals` (types-only view, pure mapper, server-only Drizzle reader - the same three-way split as `activity.ts` / `activity-map.ts` / `index.ts`). The `/jobs` page and the `/api/jobs/activity` route are the composition point: they read both read-models and assemble the page payload, which is the correct direction under the existing `lib-not-to-app` rule.

This domain read is ordinary request-scoped web-tier data access via the Drizzle pool. It is NOT a peel-safety concern: it introduces no module-level mutable singleton, no in-process cache of business state, and no request/job-spanning transaction. It is in fact more peel-safe than the liveness line ADR-0011 covers - after a web/worker peel the web tier still owns the Drizzle pool and the `scans` table, so scan history keeps working where `getWipData` liveness goes empty.

The page's composite wire type (`JobsMonitorData`) MAY reference the read-model's DTO types across a **types-only** seam (no runtime, no `server-only`). The runtime modules stay independent: `src/lib/jobs` does not import a domain reader, and the domain reader does not import the pg-boss facade.

## Consequences

- The monitor answers "what did my scan do" from the durable `scans` record, while `src/lib/jobs` keeps the narrow pg-boss-only scope ADR-0011 drew; neither facade grows knowledge of the other.
- Each read-model degrades independently: the live queue view and the scan-history view each render their own "unavailable" state, so one failing does not blank the page.
- This is the template for any future domain run-history on the monitor (it does not by itself add qualify/enrich/draft history - those have no per-run record yet): a separate Drizzle-backed read-model composed at the page, never folded into `src/lib/jobs`.
- The types-only `jobs -> signals` seam is unguarded by a fitness function today. If a runtime import later threatens the boundary, a dependency-cruiser rule forbidding a runtime `src/lib/jobs -> src/lib/signals` edge can be added; tracked as future work, not promised here.
- Peel-safety keeps its single authoritative home in ADR-0001; this ADR does not narrow it (unlike ADR-0011's exception) because a web-tier Drizzle read never engaged it.
