## 1. Facade read-model

- [x] 1.1 Define plain DTO types (`QueueActivity`, `JobActivity`, `ScheduleInfo`, and the `JobActivitySnapshot` ok/unavailable result union) in a non-`server-only` module so both the server page and the client poller can `import type` them without bundling the facade.
- [x] 1.2 Add `listJobActivity()` to `src/lib/jobs/index.ts`: compose per queue from `getQueues()` (counts), `getWipData({ includeInternal: true })` (in-memory active count, lastJobStartedOn, lastError/lastErrorOn), and `findJobs(name, { queued: true })` (waiting created+retry jobs with retry counts). Never call unfiltered `findJobs`. Map to DTOs.
- [x] 1.3 Add `listSchedules()` to `src/lib/jobs/index.ts` wrapping `getBoss().getSchedules()` into `ScheduleInfo` DTOs.
- [x] 1.4 Catch the "runtime not started" / DB-not-opened error class in both read functions, log it, and return the structured `unavailable` result instead of throwing.

## 2. Read endpoint

- [x] 2.1 Add `GET /api/jobs/activity` route handler (mirroring `src/app/api/health/route.ts`) that returns `listJobActivity()` + `listSchedules()` as JSON, marked dynamic / no-store so each poll is fresh.
- [x] 2.2 Document at the route the D1 single-user auth-deferral and that this handler is the insertion point for authorization at productization.

## 3. Jobs monitor view

- [x] 3.1 Add the `/jobs` page as a Server Component that fetches the read-model once and renders the initial snapshot.
- [x] 3.2 Add one `'use client'` poller component that takes the server snapshot as `initialData`, re-fetches `/api/jobs/activity` on an interval (~3-4s), and pauses while the tab is hidden (`visibilitychange`). State the client reason in a comment.
- [x] 3.3 Render queue cards (friendly labels, active/queued/deferred counts), the in-flight job list (state, started, liveness, retry count), the failed-job surface (failure output), and the schedules list.
- [x] 3.4 Render the idle state (no work in flight) and the `unavailable` state (background runtime not running) so the view never looks broken.

## 4. Navigation

- [x] 4.1 Add an "Operations" section to `src/app/(app)/layout.tsx` linking to `/jobs` via the existing `NavLink`, kept separate from the three anchor views.

## 5. Tests

- [x] 5.1 Unit-test the pure read-model mapping (queue counts, worker-by-name join, waiting-job mapping, schedule mapping) against faked pg-boss shapes. Pure logic was extracted to `src/lib/jobs/activity.ts` (coverage-included; `index.ts` stays excluded I/O delegation) - `tests/job-activity-monitor.test.ts`, activity.ts at 100% lines / 96% branch.
- [x] 5.2 Unit-test the `unavailable` builder (any introspection error -> structured unavailable result; nullish -> fallback reason). The facade try/catch that calls it stays in the excluded `index.ts`.
- [x] 5.3 Route handler, page, and poller live under `src/app/**`, which the coverage gate excludes by convention (exercised by the live boot, not performative unit tests; the suite has no jsdom/testing-library). No component test added, consistent with that convention.

## 6. Docs and definition of done

- [x] 6.1 Update `src/app/prototype/README.md` screen registry to record the new wired `/jobs` screen and the capability it surfaces.
- [x] 6.2 Add the `## Architecture` section links on the canonical `job-activity-monitor` spec after archive (ADR-0001, ADR-0004, background-jobs spec, the jobs screen). (Archive-time step.) Done: ADR-0011 now accepted, so the section also links it.
- [x] 6.3 Run `npm run verify` to green (typecheck, lint, format, dependency-cruiser, jscpd, per-file coverage, build). Green: build lists `/jobs` and `/api/jobs/activity`; activity.ts at 100% lines / 96% branch.
- [x] 6.4 Ran the `code-review` loop (canon + atlas, read-only). Round 1 raised 2 blockers + majors; applied fixes (spec reconciled to API reality, three-file type/runtime/IO split, waiting-row cap, narrowed try/catch). Re-ran `verify` green, re-reviewed the delta: all blockers/majors resolved, only nits (fixed mapScheduleInfo return type). ONE archive gate remains, non-code: the peel-safety exception (globalThis singleton + getWipData in-memory read vs ADR-0001) needs a human-signed ADR or ADR-0001 correction before archive - the agent must not self-accept it (see design.md Risks / Open Questions).
