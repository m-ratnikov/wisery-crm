import Link from "next/link";

// Home / "the daily loop" - a thin orientation page. The product has no dashboard (the thesis
// is anchor views + generative output), and the sidebar now carries navigation, so this no
// longer duplicates it as a link grid. The one link the sidebar omits is the prototype tour.
export default function Home() {
  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      <div className="mx-auto w-full max-w-3xl px-8 py-16">
        <h1 className="text-2xl font-semibold tracking-tight">Wisery CRM</h1>
        <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          Automate the intelligence, keep the action human. Start by configuring an ICP and a
          source, then work the queue. The system never sends - you act, it learns.
        </p>

        <p className="mt-8 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          The daily loop, in order: <strong>ICP &amp; source config</strong> &rarr; run a scan
          &rarr; <strong>prospect list</strong> &rarr; <strong>review &amp; approve queue</strong>.
          Use the sidebar to move between them.
        </p>

        <p className="mt-8 text-xs text-zinc-400">
          Design reference:{" "}
          <Link
            href="/prototype"
            className="underline hover:text-zinc-600 dark:hover:text-zinc-300"
          >
            the clickable prototype tour
          </Link>{" "}
          (mock data, not wired). Health probe at <code>/api/health</code>.
        </p>
      </div>
    </div>
  );
}
