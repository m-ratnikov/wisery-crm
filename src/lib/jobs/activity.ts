// DTO types for the job-activity read-model (job-activity-monitor). Types ONLY - no runtime,
// so this module is safe to import from the client poller as well as the server. The pure
// mappers that build these from raw pg-boss shapes live in ./activity-map (runtime, server-side,
// coverage-included); the pg-boss I/O lives in ./index (server-only). Keeping types here means a
// client value-import of mapper logic is structurally impossible, not just discouraged.
//
// Timestamps are ISO strings (not Date) so the server-rendered first paint and the polled
// /api/jobs/activity JSON have one identical shape - no Date/string drift.

import type { ScanHistorySnapshot } from "@/lib/signals/scan-history-view";

export interface WorkerLiveness {
  state: string; // WorkerState: created | active | stopping | stopped
  inFlight: number; // jobs this queue's worker is processing right now
  lastJobStartedOn: string | null;
  lastJobDurationMs: number | null;
  lastError: string | null; // most recent handler failure for the queue, if any
  lastErrorOn: string | null;
}

export interface JobActivity {
  id: string;
  state: string; // waiting states only: created | retry
  createdOn: string;
  startAfter: string | null;
  retryCount: number;
  retryLimit: number;
}

export interface QueueActivity {
  name: string;
  activeCount: number;
  queuedCount: number;
  deferredCount: number;
  totalCount: number;
  worker: WorkerLiveness | null; // null when no worker is registered in this process
  waiting: JobActivity[]; // the individual created + retry jobs, capped (see waitingTotal)
  waitingTotal: number; // true count of waiting jobs before the display cap
}

export interface ScheduleInfo {
  queue: string; // the queue the cron schedule targets
  cron: string;
  timezone: string;
}

// Discriminated so the UI can render a "runtime not running" panel instead of crashing when
// the in-process pg-boss runtime has not started (the DB-not-opened failure mode).
export type JobActivitySnapshot =
  | { status: "ok"; queues: QueueActivity[] }
  | { status: "unavailable"; reason: string };

export type ScheduleSnapshot =
  | { status: "ok"; schedules: ScheduleInfo[] }
  | { status: "unavailable"; reason: string };

// The shape returned by GET /api/jobs/activity and rendered by the monitor. It composes the
// pg-boss introspection (activity + schedules) with the scan-run-history read-model. The
// ScanHistorySnapshot import is TYPES ONLY (no runtime, no server-only), so the pg-boss read
// path and the domain read path stay independent at runtime; the page/route is the composition
// point (ADR-0012).
export interface JobsMonitorData {
  activity: JobActivitySnapshot;
  schedules: ScheduleSnapshot;
  scanHistory: ScanHistorySnapshot;
}
