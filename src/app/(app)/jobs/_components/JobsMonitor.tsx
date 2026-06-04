"use client";

import { useEffect, useState } from "react";
import type {
  JobsMonitorData,
  QueueActivity,
  ScheduleInfo,
  WorkerLiveness,
} from "@/lib/jobs/activity";

// The one client component in this feature: live status is an interval timer plus a fetch
// that re-renders, which is inherently client state. It takes the server-rendered snapshot as
// initialData (no loading flash) and polls the read endpoint, pausing while the tab is hidden.
const POLL_MS = 3500;

const QUEUE_LABELS: Record<string, string> = {
  "source-scan": "Source scan",
  qualify: "Qualify",
  "qualify-prospect": "Qualify (manual lead)",
  enrich: "Enrich",
  draft: "Draft",
  heartbeat: "Heartbeat",
};
const queueLabel = (name: string) => QUEUE_LABELS[name] ?? name;

// Deterministic UTC clock slice straight from the ISO string - no Date math, so the
// server-rendered first paint and the client hydrate identically (no hydration mismatch).
const clock = (iso: string | null) => (iso ? iso.slice(11, 19) + " UTC" : "-");

export function JobsMonitor({ initialData }: { initialData: JobsMonitorData }) {
  const [data, setData] = useState<JobsMonitorData>(initialData);
  const [live, setLive] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const tick = async () => {
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
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  const { activity, schedules } = data;

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      <div className="mx-auto w-full max-w-3xl px-8 py-10">
        <header className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Background jobs</h1>
            <p className="mt-1 text-sm text-zinc-500">
              Live view of the in-process pipeline - running and queued work, plus schedules.
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
          <QueueList queues={activity.queues} />
        )}

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

function QueueList({ queues }: { queues: QueueActivity[] }) {
  const hasWork = queues.some((q) => q.activeCount > 0 || q.waiting.length > 0);
  return (
    <>
      {!hasWork ? (
        <p className="mb-4 rounded-lg border border-dashed border-zinc-300 bg-white p-4 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900">
          No work in flight - every queue is idle.
        </p>
      ) : null}
      <ul className="space-y-3">
        {queues.map((q) => (
          <QueueCard key={q.name} queue={q} />
        ))}
      </ul>
    </>
  );
}

function QueueCard({ queue }: { queue: QueueActivity }) {
  const running = queue.activeCount > 0 || (queue.worker?.inFlight ?? 0) > 0;
  const idle = !running && queue.waiting.length === 0;
  return (
    <li className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {running ? (
            <span
              className="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-500"
              aria-hidden
            />
          ) : (
            <span
              className="inline-block h-2 w-2 rounded-full bg-zinc-300 dark:bg-zinc-600"
              aria-hidden
            />
          )}
          <span className="text-sm font-semibold">{queueLabel(queue.name)}</span>
          <span className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[11px] text-zinc-500 dark:bg-zinc-800">
            {queue.name}
          </span>
        </div>
        <div className="flex shrink-0 gap-1.5">
          <CountBadge label="active" value={queue.activeCount} tone="emerald" />
          <CountBadge label="queued" value={queue.queuedCount} tone="amber" />
          <CountBadge label="deferred" value={queue.deferredCount} tone="zinc" />
        </div>
      </div>

      {queue.worker ? <WorkerLine worker={queue.worker} /> : null}

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
                  {j.state}
                </span>
                {j.retryCount > 0 ? (
                  <span className="text-zinc-400">
                    retry {j.retryCount}/{j.retryLimit}
                  </span>
                ) : null}
                <span className="text-zinc-400">queued {clock(j.createdOn)}</span>
              </span>
            </li>
          ))}
          {queue.waitingTotal > queue.waiting.length ? (
            <li className="pt-1 text-xs text-zinc-400">
              + {queue.waitingTotal - queue.waiting.length} more waiting
            </li>
          ) : null}
        </ul>
      ) : idle ? (
        <p className="mt-2 text-xs text-zinc-400">idle</p>
      ) : null}
    </li>
  );
}

function WorkerLine({ worker }: { worker: WorkerLiveness }) {
  // Active work is surfaced as running-since liveness (not per-job rows): when the worker has
  // jobs in flight, show when the running work started; otherwise show the last completed run.
  const running = worker.inFlight > 0;
  return (
    <div className="mt-2 text-xs text-zinc-500">
      <span>
        worker {worker.state}
        {running
          ? ` - running ${worker.inFlight}${
              worker.lastJobStartedOn ? ` since ${clock(worker.lastJobStartedOn)}` : ""
            }`
          : worker.lastJobStartedOn
            ? ` - last run ${clock(worker.lastJobStartedOn)}${
                worker.lastJobDurationMs != null ? ` (${worker.lastJobDurationMs} ms)` : ""
              }`
            : ""}
      </span>
      {worker.lastError ? (
        <p className="mt-1 text-rose-600 dark:text-rose-400">
          last error {clock(worker.lastErrorOn)}: {worker.lastError}
        </p>
      ) : null}
    </div>
  );
}

function CountBadge({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "emerald" | "amber" | "zinc";
}) {
  const tones = {
    emerald:
      value > 0
        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
        : "bg-zinc-100 text-zinc-400 dark:bg-zinc-800",
    amber:
      value > 0
        ? "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
        : "bg-zinc-100 text-zinc-400 dark:bg-zinc-800",
    zinc: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
  } as const;
  return (
    <span className={`rounded px-1.5 py-0.5 text-[11px] ${tones[tone]}`}>
      {value} {label}
    </span>
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
