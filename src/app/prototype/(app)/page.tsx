import { Fragment } from "react";
import Link from "next/link";
import { SourceChip } from "./_components/SourceChip";
import {
  activity,
  belowBar,
  funnel,
  queueSummary,
  recentScans,
  type FunnelStage,
  type PipelineActivity,
} from "./_data/home";

// The whole-app shell: a clickable view of the primary journey (the daily loop).
// Server Component on purpose - it is read-only status and navigation, the
// RSC-first default. The three anchor views are where judgment and interaction live.
export default function PrototypeHome() {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-5xl px-8 py-10">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">The daily loop</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
              Configure once, then the pipeline finds, scores, and drafts in the background. You
              work the queue: review the draft, deepen any prospect with optional enrichment, then
              act manually. Wisery never sends (D2).
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/prototype/icp-config"
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Configure
            </Link>
            <Link
              href="/prototype/review-queue"
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              Open queue
            </Link>
          </div>
        </header>

        <section className="mt-8">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Pipeline</h2>
          <div className="mt-3 flex items-stretch gap-2 overflow-x-auto pb-2">
            {funnel.map((stage, index) => (
              <Fragment key={stage.key}>
                <StageCard stage={stage} />
                {index < funnel.length - 1 && (
                  <span className="flex items-center text-zinc-300 dark:text-zinc-600" aria-hidden>
                    &rarr;
                  </span>
                )}
              </Fragment>
            ))}
          </div>
          <p className="mt-3 text-xs leading-5 text-zinc-500">
            {belowBar} scored below the bar, kept silently for the learning loop (D7). The qualifier
            is the cost gate: only 3+ prospects are drafted; enrichment is optional and
            user-triggered.
          </p>
        </section>

        <section className="mt-8">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
            Running now
          </h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {activity.map((item) => (
              <ActivityCard key={item.key} item={item} />
            ))}
          </div>
          <p className="mt-3 text-xs leading-5 text-zinc-500">
            The pipeline runs in the background as jobs. You never wait on it - work the queue, and
            new prospects arrive as scans and drafts finish.
          </p>
        </section>

        <div className="mt-8 grid gap-5 md:grid-cols-2">
          <Panel
            title="Recent scans"
            action={{ label: "Configure sources", href: "/prototype/icp-config" }}
          >
            <ul className="space-y-2.5">
              {recentScans.map((scan) => (
                <li key={scan.label} className="flex items-center gap-3 text-sm">
                  <SourceChip kind={scan.kind} />
                  <span className="min-w-0 flex-1 truncate text-zinc-600 dark:text-zinc-300">
                    {scan.label}
                  </span>
                  <span className="shrink-0 font-medium text-emerald-600 dark:text-emerald-400">
                    +{scan.added}
                  </span>
                  <span className="w-14 shrink-0 text-right text-xs text-zinc-400">{scan.at}</span>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Your queue">
            <Link href="/prototype/review-queue" className="group block">
              <p className="text-3xl font-semibold tracking-tight">
                {queueSummary.ready}
                <span className="ml-2 text-sm font-normal text-zinc-500 group-hover:text-zinc-900 dark:group-hover:text-zinc-100">
                  prospects ready to act &rarr;
                </span>
              </p>
            </Link>
            <p className="mt-1 text-xs text-zinc-500">{queueSummary.draftedToday} drafted today.</p>
            <Link
              href="/prototype/prospect-list"
              className="mt-4 inline-block text-sm font-medium text-zinc-600 underline-offset-2 hover:underline dark:text-zinc-400"
            >
              Browse all prospects &rarr;
            </Link>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function ActivityCard({ item }: { item: PipelineActivity }) {
  const running = item.state === "running";
  return (
    <div className="rounded-lg border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center gap-2">
        <span
          className={`h-2 w-2 rounded-full ${
            running ? "animate-pulse bg-emerald-500" : "bg-zinc-300 dark:bg-zinc-600"
          }`}
          aria-hidden
        />
        <span className="text-sm font-medium">{item.label}</span>
        <span className="ml-auto text-[10px] uppercase tracking-wide text-zinc-400">
          {running ? "running" : "queued"}
        </span>
      </div>
      <p className="mt-1 pl-4 text-xs text-zinc-500">{item.detail}</p>
    </div>
  );
}

function StageCard({ stage }: { stage: FunnelStage }) {
  const body = (
    <>
      <span className="text-2xl font-semibold tracking-tight">{stage.count}</span>
      <span className="mt-0.5 block text-xs text-zinc-500">{stage.label}</span>
      {stage.emphasis && (
        <span className="mt-1 block text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
          waiting on you &rarr;
        </span>
      )}
    </>
  );

  const base = "min-w-[7rem] flex-1 rounded-lg border px-4 py-3";
  if (stage.href) {
    return (
      <Link
        href={stage.href}
        className={`${base} border-emerald-300 bg-emerald-50 transition-colors hover:border-emerald-400 dark:border-emerald-500/40 dark:bg-emerald-500/10`}
      >
        {body}
      </Link>
    );
  }
  return (
    <div className={`${base} border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900`}>
      {body}
    </div>
  );
}

function Panel({
  title,
  action,
  children,
}: {
  title: string;
  action?: { label: string; href: string };
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">{title}</h2>
        {action && (
          <Link
            href={action.href}
            className="text-xs font-medium text-zinc-500 underline-offset-2 hover:underline dark:text-zinc-400"
          >
            {action.label} &rarr;
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}
