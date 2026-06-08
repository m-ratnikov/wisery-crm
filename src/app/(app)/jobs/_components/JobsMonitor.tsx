"use client";

import { useEffect, useState } from "react";
import type {
  JobsMonitorData,
  QueueActivity,
  ScheduleInfo,
  WorkerLiveness,
} from "@/lib/jobs/activity-view";
import type { ScanHistorySnapshot, ScanRunView } from "@/lib/signals/scan-history-view";

// The one client component in this feature: live status is an interval timer plus a fetch
// that re-renders, which is inherently client state. It takes the server-rendered snapshot as
// initialData (no loading flash) and polls the read endpoint, pausing while the tab is hidden.
const POLL_MS = 3500;

// The currently-registered background queues (bootstrap.ts). Scoring and message generation are now
// synchronous on-demand Person actions, not workers (ADR-0019), so qualify / qualify-prospect / draft
// are gone; an unknown name falls back to its raw name.
const QUEUE_LABELS: Record<string, string> = {
  "source-scan": "Source scan",
  "advisory-filter": "Advisory filter",
  enrich: "Enrich",
  "fetch-posts": "Fetch posts",
  "activity-scan": "Activity scan",
  heartbeat: "Heartbeat",
};
const queueLabel = (name: string) => QUEUE_LABELS[name] ?? name;

// A plain one-line description of what each queue does, so a non-engineer can read the monitor.
const QUEUE_DESCRIPTIONS: Record<string, string> = {
  "source-scan": "Discovers new signals from your connected sources.",
  "advisory-filter": "Scores each new signal against its rubric for the Queue's advisory hint.",
  enrich: "Builds a deep research dossier for a prospect.",
  "fetch-posts": "Fetches a monitored person's latest posts for the Feed.",
  "activity-scan": "Sweeps monitored people on a schedule to fetch new posts.",
  heartbeat: "Internal liveness check that proves the worker is running.",
};
const queueDescription = (name: string) => QUEUE_DESCRIPTIONS[name] ?? "";

// Deterministic UTC clock slice straight from the ISO string - no Date math, so the
// server-rendered first paint and the client hydrate identically (no hydration mismatch).
const clock = (iso: string | null) => (iso ? iso.slice(11, 19) + " UTC" : "-");

// Human relative time. `now` is null until the client has mounted (set in an effect), so the
// server render and the first client paint both fall back to the deterministic clock slice -
// the relative phrasing only appears after hydration, never causing a mismatch.
function ago(iso: string | null, now: number | null): string {
  if (!iso) return "-";
  if (now == null) return clock(iso);
  const diffMs = now - Date.parse(iso);
  if (diffMs < 45_000) return "just now";
  const min = Math.floor(diffMs / 60_000);
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} h ago`;
  return `${Math.floor(hr / 24)} d ago`;
}

export function JobsMonitor({ initialData }: { initialData: JobsMonitorData }) {
  const [data, setData] = useState<JobsMonitorData>(initialData);
  const [live, setLive] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  // Wall-clock reference for relative times; null on the server and first paint (see `ago`),
  // then seeded after mount and refreshed each poll so "min ago" stays current.
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    // Seed the relative-time clock just after mount (deferred via a 0ms timer, so it is not a
    // synchronous setState in the effect body). Until it fires, `ago` shows the SSR-safe UTC
    // slice, so the first client paint matches the server render.
    const seed = setTimeout(() => setNow(Date.now()), 0);

    const tick = async () => {
      setNow(Date.now());
      if (document.hidden) {
        setLive(false);
        timer = setTimeout(() => void tick(), POLL_MS);
        return;
      }
      setLive(true);
      try {
        const res = await fetch("/api/jobs/activity", { cache: "no-store" });
        if (!cancelled && res.ok) {
          setData((await res.json()) as JobsMonitorData);
          setUpdatedAt(new Date().toLocaleTimeString());
        }
      } catch {
        // Transient fetch failure: keep the last good snapshot and retry next tick.
      }
      if (!cancelled) timer = setTimeout(() => void tick(), POLL_MS);
    };

    timer = setTimeout(() => void tick(), POLL_MS);
    const onVisibility = () => setLive(!document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      clearTimeout(seed);
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  const { activity, schedules, scanHistory } = data;

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      <div className="mx-auto w-full max-w-3xl px-8 py-10">
        <header className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Background jobs</h1>
            <p className="mt-1 text-sm text-zinc-500">
              Live view of the in-process pipeline - what each stage is doing now, recent scans, and
              schedules.
            </p>
          </div>
          <span
            className="flex shrink-0 items-center gap-1.5 rounded-full border border-zinc-200 px-2.5 py-1 text-[11px] text-zinc-500 dark:border-zinc-700"
            title={updatedAt ? `Last updated ${updatedAt}` : undefined}
          >
            <span
              className={`inline-block h-1.5 w-1.5 rounded-full ${live ? "bg-emerald-500" : "bg-zinc-400"}`}
              aria-hidden
            />
            {live ? "Live" : "Paused"}
          </span>
        </header>

        {activity.status === "unavailable" ? (
          <RuntimeUnavailable reason={activity.reason} />
        ) : (
          <QueueList queues={activity.queues} now={now} />
        )}

        <ScanHistorySection scanHistory={scanHistory} now={now} />

        <section className="mt-8">
          <h2 className="mb-3 text-sm font-semibold">Scheduled jobs</h2>
          {schedules.status === "unavailable" ? (
            <p className="text-sm text-zinc-500">Unavailable while the runtime is not running.</p>
          ) : schedules.schedules.length === 0 ? (
            <p className="text-sm text-zinc-500">No cron schedules registered.</p>
          ) : (
            <ul className="divide-y divide-zinc-100 rounded-lg border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
              {schedules.schedules.map((s) => (
                <ScheduleRow key={`${s.queue}:${s.cron}`} schedule={s} />
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function RuntimeUnavailable({ reason }: { reason: string }) {
  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 p-5 text-sm dark:border-amber-500/40 dark:bg-amber-500/10">
      <p className="font-medium text-amber-800 dark:text-amber-200">
        Background runtime is not running
      </p>
      <p className="mt-1 text-amber-700 dark:text-amber-300/80">
        No job activity to show. The in-process worker has not started.
      </p>
      <p className="mt-2 font-mono text-xs text-amber-700/80 dark:text-amber-300/60">{reason}</p>
    </div>
  );
}

function QueueList({ queues, now }: { queues: QueueActivity[]; now: number | null }) {
  const hasWork = queues.some((q) => q.activeCount > 0 || q.queuedCount > 0 || q.deferredCount > 0);
  return (
    <>
      {!hasWork ? (
        <p className="mb-4 rounded-lg border border-dashed border-zinc-300 bg-white p-4 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900">
          Nothing running right now - every stage is idle and waiting for work.
        </p>
      ) : null}
      <ul className="space-y-3">
        {queues.map((q) => (
          <QueueCard key={q.name} queue={q} now={now} />
        ))}
      </ul>
    </>
  );
}

function QueueCard({ queue, now }: { queue: QueueActivity; now: number | null }) {
  const inFlight = queue.activeCount > 0 || (queue.worker?.inFlight ?? 0) > 0;
  // queuedCount (due now) and deferredCount (scheduled / retry backoff) are distinct,
  // non-overlapping getQueues buckets; both mean work is pending, so neither alone is "Idle".
  const waitingCount = queue.queuedCount + queue.deferredCount;
  const status = inFlight ? "Running" : waitingCount > 0 ? "Queued" : "Idle";
  const description = queueDescription(queue.name);

  return (
    <li className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span
            className={`inline-block h-2 w-2 rounded-full ${
              inFlight
                ? "animate-pulse bg-emerald-500"
                : waitingCount > 0
                  ? "bg-amber-400"
                  : "bg-zinc-300 dark:bg-zinc-600"
            }`}
            aria-hidden
          />
          <span className="text-sm font-semibold">{queueLabel(queue.name)}</span>
        </div>
        <StatusPill status={status} />
      </div>

      {description ? <p className="mt-1.5 text-xs text-zinc-500">{description}</p> : null}

      <p className="mt-1.5 text-xs text-zinc-500">{queueStatusLine(queue, inFlight, now)}</p>

      {queue.worker?.lastError ? (
        <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">
          Last error {ago(queue.worker.lastErrorOn, now)}: {queue.worker.lastError}
        </p>
      ) : null}

      {queue.waiting.length > 0 ? (
        <ul className="mt-3 space-y-1 border-t border-zinc-100 pt-3 dark:border-zinc-800">
          {queue.waiting.map((j) => (
            <li
              key={j.id}
              className="flex items-center justify-between gap-3 text-xs text-zinc-600 dark:text-zinc-400"
            >
              <span className="font-mono text-zinc-400">{j.id.slice(0, 8)}</span>
              <span className="flex items-center gap-2">
                <span className={j.state === "retry" ? "text-amber-600 dark:text-amber-400" : ""}>
                  {j.state === "retry" ? "retrying" : "waiting"}
                </span>
                {j.retryCount > 0 ? (
                  <span className="text-zinc-400">
                    attempt {j.retryCount + 1} of {j.retryLimit + 1}
                  </span>
                ) : null}
                <span className="text-zinc-400">since {ago(j.createdOn, now)}</span>
              </span>
            </li>
          ))}
          {queue.waitingTotal > queue.waiting.length ? (
            <li className="pt-1 text-xs text-zinc-400">
              + {queue.waitingTotal - queue.waiting.length} more waiting
            </li>
          ) : null}
        </ul>
      ) : null}
    </li>
  );
}

// One human-readable status line per queue: what it is doing now, or when it last ran. Replaces
// the active/queued/deferred badge row and the raw "worker active - last run ... (1 ms)" line.
function queueStatusLine(queue: QueueActivity, inFlight: boolean, now: number | null): string {
  const worker: WorkerLiveness | null = queue.worker;
  if (inFlight) {
    // Postgres active count and the in-process worker's in-flight count can disagree (timing,
    // or another worker holds the job); take the larger so a "Running" card never says "0 jobs".
    const count = Math.max(queue.activeCount, queue.worker?.inFlight ?? 0);
    const since = worker?.lastJobStartedOn ? ` (started ${ago(worker.lastJobStartedOn, now)})` : "";
    return `Running ${count} job${count === 1 ? "" : "s"}${since}.`;
  }
  const waitingCount = queue.queuedCount + queue.deferredCount;
  if (waitingCount > 0) {
    return `${waitingCount} job${waitingCount === 1 ? "" : "s"} waiting to run.`;
  }
  if (worker?.lastJobStartedOn) {
    return `Idle - last ran ${ago(worker.lastJobStartedOn, now)}.`;
  }
  return "Idle - no work yet.";
}

function StatusPill({ status }: { status: "Running" | "Queued" | "Idle" }) {
  const tone =
    status === "Running"
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
      : status === "Queued"
        ? "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
        : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400";
  return <span className={`rounded px-2 py-0.5 text-[11px] font-medium ${tone}`}>{status}</span>;
}

// The scan-run-history surface (scan-run-history): what a scan actually did, read from the
// recorded runs, so an idle queue after a fast scan still has a visible outcome. Degrades on its
// own (independent of the live-queue section) when the read is unavailable.
function ScanHistorySection({
  scanHistory,
  now,
}: {
  scanHistory: ScanHistorySnapshot;
  now: number | null;
}) {
  return (
    <section className="mt-8">
      <h2 className="mb-3 text-sm font-semibold">Recent scans</h2>
      {scanHistory.status === "unavailable" ? (
        <p className="text-sm text-zinc-500">Scan history is unavailable right now.</p>
      ) : scanHistory.runs.length === 0 ? (
        <p className="text-sm text-zinc-500">No scans recorded yet.</p>
      ) : (
        <ul className="divide-y divide-zinc-100 rounded-lg border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
          {scanHistory.runs.map((run) => (
            <ScanRow key={run.id} run={run} now={now} />
          ))}
        </ul>
      )}
    </section>
  );
}

function ScanRow({ run, now }: { run: ScanRunView; now: number | null }) {
  const failed = run.status === "failed";
  return (
    <li className="flex items-start justify-between gap-3 px-4 py-2.5">
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-sm">
          <span
            className={`inline-block h-2 w-2 shrink-0 rounded-full ${
              run.status === "running"
                ? "animate-pulse bg-emerald-500"
                : failed
                  ? "bg-rose-500"
                  : "bg-zinc-300 dark:bg-zinc-600"
            }`}
            aria-hidden
          />
          <span className="truncate font-medium">{run.sourceLabel}</span>
        </div>
        <p
          className={`mt-0.5 text-xs ${failed ? "text-rose-600 dark:text-rose-400" : "text-zinc-500"}`}
        >
          {run.summary}
        </p>
      </div>
      <span className="shrink-0 text-xs text-zinc-400" title={clock(run.startedOn)}>
        {ago(run.startedOn, now)}
      </span>
    </li>
  );
}

function ScheduleRow({ schedule }: { schedule: ScheduleInfo }) {
  return (
    <li className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
      <span className="font-medium">{queueLabel(schedule.queue)}</span>
      <span className="flex items-center gap-3 text-xs text-zinc-500">
        <span className="font-mono">{schedule.cron}</span>
        <span>{schedule.timezone}</span>
      </span>
    </li>
  );
}
