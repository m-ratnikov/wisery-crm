import Link from "next/link";
import { SourceChip } from "./_components/SourceChip";
import { activity, recentScans, type PipelineActivity } from "./_data/home";
import { pendingSignals } from "./_data/signals";
import { peopleList } from "./_data/people";
import { feedPosts } from "./_data/feed";

// The whole-app shell: a clickable view of the primary journey (the daily loop).
// Server Component on purpose - read-only status and navigation, the RSC-first
// default. The anchor views are where judgment and interaction live. Counts are
// derived from the mock data so the shell stays consistent with the screens.
export default function PrototypeHome() {
  const people = peopleList();
  const pendingCount = pendingSignals.length;
  const prospects = people.filter((person) => person.type === "prospect").length;
  const monitored = people.filter((person) => person.monitored).length;
  const needsComment = feedPosts.filter(
    (post) => !post.comments.some((comment) => comment.status === "posted"),
  ).length;

  const steps = [
    {
      key: "configure",
      label: "Configure",
      detail: "ICP, profile, sources",
      href: "/prototype/icp-config",
      count: null as number | null,
    },
    {
      key: "queue",
      label: "Triage the Queue",
      detail: "approve into people / companies",
      href: "/prototype/queue",
      count: pendingCount,
    },
    {
      key: "people",
      label: "Work people",
      detail: "enrich, message, comment",
      href: "/prototype/people",
      count: prospects,
    },
    {
      key: "feed",
      label: "Engage the Feed",
      detail: "comment on monitored posts",
      href: "/prototype/feed",
      count: needsComment,
    },
  ];

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-5xl px-8 py-10">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">The daily loop</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
              The pipeline scans and advisory-scores signals in the background. You triage the Queue
              into people and companies, then work each person with on-demand actions - enrich,
              generate a message or a comment. Every send and every comment is yours to post by hand
              (D2).
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
              href="/prototype/queue"
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              Open Queue
            </Link>
          </div>
        </header>

        <section className="mt-8">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">The loop</h2>
          <div className="mt-3 flex items-stretch gap-2 overflow-x-auto pb-2">
            {steps.map((step, index) => (
              <div key={step.key} className="flex items-stretch gap-2">
                <Link
                  href={step.href}
                  className="min-w-[10rem] flex-1 rounded-lg border border-zinc-200 bg-white px-4 py-3 transition-colors hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
                >
                  <span className="flex items-baseline gap-2">
                    <span className="text-sm font-semibold">{step.label}</span>
                    {step.count !== null && (
                      <span className="rounded-full bg-zinc-100 px-1.5 text-[11px] font-medium text-zinc-500 dark:bg-zinc-800">
                        {step.count}
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 block text-xs text-zinc-500">{step.detail}</span>
                </Link>
                {index < steps.length - 1 && (
                  <span className="flex items-center text-zinc-300 dark:text-zinc-600" aria-hidden>
                    &rarr;
                  </span>
                )}
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs leading-5 text-zinc-500">
            The advisory score is a triage hint, never a gate - and the only score in the system
            (ADR-0022). Enrichment and generation are on-demand actions on a person - spend is
            incurred only when you click (ADR-0019).
          </p>
        </section>

        <section className="mt-8">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
            Running now
          </h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {activity.map((item) => (
              <ActivityCard key={item.key} item={item} />
            ))}
          </div>
          <p className="mt-3 text-xs leading-5 text-zinc-500">
            Only scan, the advisory filter, and the activity scan run as background jobs. Everything
            else waits for your click.
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

          <Panel title="Waiting on you">
            <Link href="/prototype/queue" className="group block">
              <p className="text-3xl font-semibold tracking-tight">
                {pendingCount}
                <span className="ml-2 text-sm font-normal text-zinc-500 group-hover:text-zinc-900 dark:group-hover:text-zinc-100">
                  signals to triage &rarr;
                </span>
              </p>
            </Link>
            <p className="mt-1 text-xs text-zinc-500">
              {monitored} people monitored · {needsComment} posts need a comment.
            </p>
            <Link
              href="/prototype/feed"
              className="mt-4 inline-block text-sm font-medium text-zinc-600 underline-offset-2 hover:underline dark:text-zinc-400"
            >
              Open the Feed &rarr;
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
          {running ? "running" : "idle"}
        </span>
      </div>
      <p className="mt-1 pl-4 text-xs text-zinc-500">{item.detail}</p>
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
