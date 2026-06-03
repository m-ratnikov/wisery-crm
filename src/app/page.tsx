import Link from "next/link";

// A minimal entry index into the wired anchor views (the product has no separate dashboard -
// the thesis is anchor views + generative output; the clickable journey lives in /prototype).
const destinations = [
  {
    href: "/icp-config",
    title: "ICP & source config",
    blurb: "Define the scoring rubric and your profile, configure a source, and run a scan.",
    tag: "Anchor 1",
  },
  {
    href: "/prospect-list",
    title: "Prospect list",
    blurb: "Browse every prospect with its score, status, and enriched/drafted facets.",
    tag: "Anchor 3",
  },
  {
    href: "/review-queue",
    title: "Review & approve queue",
    blurb: "Act on queued prospects, then log the outcome against the score.",
    tag: "Anchor 2",
  },
  {
    href: "/prototype",
    title: "Prototype tour",
    blurb: "The clickable mockups of the full journey (design reference, not wired).",
    tag: "Mockups",
  },
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      <div className="mx-auto w-full max-w-3xl px-8 py-16">
        <h1 className="text-2xl font-semibold tracking-tight">Wisery CRM</h1>
        <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          Automate the intelligence, keep the action human. Start by configuring an ICP and a
          source, then work the queue. The system never sends - you act, it learns.
        </p>

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          {destinations.map((d) => (
            <Link
              key={d.href}
              href={d.href}
              className="group rounded-lg border border-zinc-200 bg-white p-5 transition-colors hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">{d.title}</h2>
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                  {d.tag}
                </span>
              </div>
              <p className="mt-1.5 text-sm leading-6 text-zinc-600 dark:text-zinc-400">{d.blurb}</p>
            </Link>
          ))}
        </div>

        <p className="mt-8 text-xs text-zinc-400">
          Suggested flow: ICP &amp; source config &rarr; run a scan &rarr; prospect list &rarr;
          review queue. Health probe at <code>/api/health</code>.
        </p>
      </div>
    </div>
  );
}
