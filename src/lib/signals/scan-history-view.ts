// DTO types for the scan-run-history read-model. Types ONLY - no runtime - so the monitor's
// client poller can import them alongside the jobs-activity DTOs. The pure mapper that builds
// these from rows lives in ./scan-history-map (runtime, server-side); the Drizzle I/O lives in
// ./scan-history (server-only). This is the same three-way split as the jobs read-model
// (activity.ts / activity-map.ts / index.ts), kept as a SEPARATE domain read-model composed
// into the monitor page rather than folded into the pg-boss facade (ADR-0012).
//
// Timestamps are ISO strings (not Date), matching JobsMonitorData, so the server-rendered first
// paint and the polled /api/jobs/activity JSON share one shape (no hydration drift).

export type ScanRunStatus = "running" | "completed" | "failed";

export interface ScanRunView {
  id: string;
  sourceLabel: string; // the source's display name, falling back to its kind
  status: ScanRunStatus;
  startedOn: string; // ISO
  finishedOn: string | null; // ISO; null while running
  summary: string; // plain-language outcome derived from status + counts
  fetched: number;
  persisted: number;
  dropped: number;
}

// Discriminated like JobActivitySnapshot so the UI can render its own "unavailable" panel
// independently of the live-queue section (each read-model degrades on its own).
export type ScanHistorySnapshot =
  | { status: "ok"; runs: ScanRunView[] }
  | { status: "unavailable"; reason: string };
