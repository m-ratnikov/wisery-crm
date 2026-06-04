## 0. Preconditions (gates)

- [x] 0.1 Confirm ADR-0012 has been signed off (status moved past `proposed` by a human); do not self-accept (project convention). Signed off 2026-06-04; status now `accepted`.
- [x] 0.2 Confirm the in-flight `job-activity-monitor` change has archived (this change modifies that capability via a delta). Archived as `2026-06-04-job-activity-monitor`; canonical spec now exists at `openspec/specs/job-activity-monitor/spec.md`.

## 1. Scan-history read-model (src/lib/signals)

- [x] 1.1 Add `src/lib/signals/scan-history-view.ts` (types only, client-safe, no runtime): `ScanRunView` (id, sourceLabel, status, startedOn/finishedOn as ISO strings, summary string, plus the raw counts the UI may show) and `ScanHistorySnapshot` discriminated `{ status: "ok"; runs: ScanRunView[] } | { status: "unavailable"; reason: string }`. Mirror the shape and the ISO-string convention of `src/lib/jobs/activity.ts`.
- [x] 1.2 Add `src/lib/signals/scan-history-map.ts` (pure, runtime, server-side): a row -> `ScanRunView` mapper and a `summarize(status, counts, error)` helper implementing design D4 (failed -> error; running -> "in progress"; completed+fetched 0 -> "nothing matched"; completed+persisted>0 -> "fetched N, M new" [+ "K already seen" when dropped>0]; completed+fetched>0+persisted 0 -> "no new signals, all already seen"). No I/O. Reuse `errorToText`/ISO helpers pattern from `activity-map.ts` (extract a shared helper only if a third caller appears - rule of three).
- [x] 1.3 Add `src/lib/signals/scan-history.ts` (`server-only`): `listScanHistory(limit = 20)` reading `scans` join `sources` via `getDb()`, ordered by `startedAt` desc, `LIMIT`, deriving a readable `sourceLabel` from the source (kind + identifying config field). Wrap the query in the same degrade-to-`unavailable` try/catch as `listJobActivity`; log a warning on failure. Returns `ScanHistorySnapshot`. Do NOT add this file to the coverage exclude list.

## 2. Hide internal pg-boss queues (job-activity-monitor delta)

- [x] 2.1 In the activity read path (`src/lib/jobs/index.ts` `listJobActivity`, and/or the `assembleActivity` mapper in `activity-map.ts`), exclude queues whose name starts with the reserved `__pgboss__` prefix from the returned/displayed queue list. Keep `getWipData({ includeInternal: true })` as-is (liveness collection unchanged); only the user-facing queue set is filtered. Put the filter where it is unit-testable - prefer filtering in `assembleActivity` so it is covered by `activity-map` tests.
- [x] 2.2 Add a mapper unit test asserting a `__pgboss__send-it` queue (and any `__pgboss__*`) is excluded while application queues (`source-scan`, `qualify`, `enrich`, `draft`, `heartbeat`) pass through.

## 3. Wire the scan history into the monitor payload

- [x] 3.1 Add `scanHistory: ScanHistorySnapshot` to `JobsMonitorData` in `src/lib/jobs/activity.ts` via a types-only import of `ScanHistorySnapshot` from `@/lib/signals/scan-history-view` (design D3 - types-only seam; no runtime import).
- [x] 3.2 Update `src/app/(app)/jobs/page.tsx` to also call `listScanHistory()` (in the existing `Promise.all`) and include `scanHistory` in `initialData`.
- [x] 3.3 Update `src/app/api/jobs/activity/route.ts` to also call `listScanHistory()` and include `scanHistory` in the JSON body, so the existing poll refreshes scan history (design D5). Keep the auth-deferral comment intact.

## 4. Monitor UI (src/app/(app)/jobs/_components/JobsMonitor.tsx)

- [x] 4.1 Add a "Recent scans" section rendering `scanHistory`: one row per run with source label, a status indicator (running / completed / failed), the summary text, and a relative/clock time using the existing ISO-string `clock` helper convention. Render an `unavailable` state for scan history independently of the queue section (design risk: independent degradation). Empty state: a plain "No scans recorded yet" line.
- [x] 4.2 Humanize the queue cards: add a short one-line description per application queue (a `QUEUE_DESCRIPTIONS` map beside the existing `QUEUE_LABELS`), and replace the active/queued/deferred badges + duplicated raw queue name with a human status line (Idle / Running / Last ran ...). Keep the raw name available only as secondary/muted detail or drop it. No em-dashes.
- [x] 4.3 Verify the internal queue no longer renders a card (it is filtered upstream in 2.1) and the humanized empty state still reads sensibly when every queue is idle.

## 5. Tests

- [x] 5.1 Unit-test `scan-history-map.ts`: one case per design-D4 branch (new signals, all-already-seen, nothing matched, failed-with-error, running), asserting the exact summary phrasing the spec scenarios describe.
- [x] 5.2 Integration-test `scan-history.ts` against the dev DB (TEST_DATABASE_URL, following the existing integration-suite pattern): seed a `source` and several `scans` rows (mixed statuses/counts), assert most-recent-first ordering, the `LIMIT` bound, the `sourceLabel`, and that the snapshot maps to the expected `ScanRunView`s.
- [x] 5.3 Extend/confirm the `activity-map` test from 2.2 covers the `__pgboss__*` exclusion.

## 6. Verify and review

- [x] 6.1 Run `npm run verify` (typecheck, lint, format, dependency-cruiser, jscpd, per-file coverage, build) until green.
- [x] 6.2 Run a `code-review` pass on the diff; apply fixes; re-run `verify` AND re-review the fix delta with full context (loop, not one-shot) until a pass finds nothing material.
- [x] 6.3 Manually verified on `/jobs`: a real linkedin-jobs scan run showed in "Recent scans" with its plain-language failure outcome (the connector is a deliberate ADR-0002 stub); `__pgboss__send-it` confirmed gone from the live `/api/jobs/activity` payload. The "nothing matched" / "all already seen" phrasings are proven by the mapper unit tests (a working connector is blocked on ADR-0002, so they cannot be produced live yet).
- [x] 6.4 Update the prototype screen registry README if the jobs screen's surfaced-capabilities join changes (it now surfaces `scan-run-history`).



