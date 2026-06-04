import type { JobWithMetadata, QueueResult, Schedule, WipData } from "pg-boss";
import type {
  JobActivity,
  JobActivitySnapshot,
  QueueActivity,
  ScheduleInfo,
  ScheduleSnapshot,
  WorkerLiveness,
} from "@/lib/jobs/activity";

// The pure, testable half of the job-activity read-model (job-activity-monitor): it maps raw
// pg-boss shapes to the DTOs the monitor renders. The pg-boss I/O lives in ./index (the thin,
// coverage-excluded facade); this module stays free of I/O so its mapping is unit-tested, the
// same split as the LinkedIn connector (normalizeJob vs the network client). DTO types live in
// ./activity (types-only, client-safe); this module is runtime and server-side.

// Cap the individual waiting-job rows we map and transmit per queue. findJobs has no SQL LIMIT,
// so the cap is applied in memory: it bounds the browser payload when a queue backs up (the
// exact case the monitor exists to catch), while waitingTotal carries the true backlog so the UI
// can show "+N more". The aggregate counts (getQueues) remain exact regardless.
export const MAX_WAITING_PER_QUEUE = 50;

export const msToIso = (ms: number | null | undefined): string | null =>
  ms == null ? null : new Date(ms).toISOString();

export const dateToIso = (d: Date | null | undefined): string | null =>
  d == null ? null : new Date(d).toISOString();

export function errorToText(err: unknown): string | null {
  if (err == null) return null;
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  if (typeof err === "object" && "message" in err && typeof err.message === "string") {
    return err.message;
  }
  try {
    return JSON.stringify(err);
  } catch {
    return "unserializable error value";
  }
}

export function mapWorkerLiveness(w: WipData): WorkerLiveness {
  return {
    state: w.state,
    inFlight: w.count,
    lastJobStartedOn: msToIso(w.lastJobStartedOn),
    lastJobDurationMs: w.lastJobDuration ?? null,
    lastError: errorToText(w.lastError),
    lastErrorOn: msToIso(w.lastErrorOn),
  };
}

export function mapJobActivity(j: JobWithMetadata): JobActivity {
  return {
    id: j.id,
    state: j.state,
    createdOn: dateToIso(j.createdOn) ?? "",
    startAfter: dateToIso(j.startAfter),
    retryCount: j.retryCount,
    retryLimit: j.retryLimit,
  };
}

export function mapScheduleInfo(s: Schedule): ScheduleInfo {
  return { queue: s.name, cron: s.cron, timezone: s.timezone };
}

// Assemble the ok activity snapshot from raw pg-boss inputs. waitingByQueue maps a queue name to
// its waiting (created + retry) jobs - the result of findJobs(name, { queued: true }). The rows
// are capped per queue; waitingTotal reports the true count.
export function assembleActivity(
  queues: QueueResult[],
  wip: WipData[],
  waitingByQueue: Map<string, JobWithMetadata[]>,
): JobActivitySnapshot {
  const wipByQueue = new Map<string, WorkerLiveness>();
  for (const w of wip) wipByQueue.set(w.name, mapWorkerLiveness(w));
  const result: QueueActivity[] = queues.map((q) => {
    const waitingRows = waitingByQueue.get(q.name) ?? [];
    return {
      name: q.name,
      activeCount: q.activeCount,
      queuedCount: q.queuedCount,
      deferredCount: q.deferredCount,
      totalCount: q.totalCount,
      worker: wipByQueue.get(q.name) ?? null,
      waiting: waitingRows.slice(0, MAX_WAITING_PER_QUEUE).map(mapJobActivity),
      waitingTotal: waitingRows.length,
    };
  });
  return { status: "ok", queues: result };
}

export function assembleSchedules(schedules: Schedule[]): ScheduleSnapshot {
  return { status: "ok", schedules: schedules.map(mapScheduleInfo) };
}

// Degrade an introspection failure (typically the runtime not started) to a structured
// unavailable result usable by either snapshot union.
export function unavailable(err: unknown): { status: "unavailable"; reason: string } {
  return { status: "unavailable", reason: errorToText(err) ?? "background runtime not running" };
}
