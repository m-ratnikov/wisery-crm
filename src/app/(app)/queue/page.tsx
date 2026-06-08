import type { Metadata } from "next";
import { listTriage, type TriageItem } from "@/lib/triage/read";
import { approveAction, dismissAction } from "./actions";

// The unified Queue (universal-triage, ADR-0013; on-demand scoring, ADR-0019): every pending signal
// waits here for a human approve/dismiss, annotated with an advisory hint. Approve creates the right
// record (a Person for person/content, a Company for company) and promotes the advisory score into
// the person's initial assessment - no automatic drafting stage. A minimum-advisory-score filter
// narrows the lane to qualifying signals. Server Component.
export const metadata: Metadata = {
  title: "Queue - Wisery CRM",
};

function payloadName(payload: unknown): string {
  if (payload && typeof payload === "object") {
    const p = payload as Record<string, unknown>;
    for (const key of ["name", "company", "title"]) {
      const v = p[key];
      if (typeof v === "string" && v) return v;
    }
  }
  return "(unnamed)";
}

// Approve creates a Company for a company signal, a Person otherwise (person/job -> prospect,
// content -> peer). The button names the entity the approval creates (ADR-0016/0019).
function createLabel(kind: string): string {
  return kind === "company" ? "Create Company" : "Create Person";
}

export default async function QueuePage({
  searchParams,
}: {
  searchParams: Promise<{ minScore?: string }>;
}) {
  const { minScore: minScoreParam } = await searchParams;
  const parsed = Number(minScoreParam);
  const minScore = minScoreParam && Number.isFinite(parsed) ? parsed : undefined;
  const items = await listTriage(minScore === undefined ? {} : { minScore });

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      <div className="mx-auto w-full max-w-2xl px-8 py-10">
        <header className="mb-6">
          <h1 className="text-lg font-semibold tracking-tight">Queue</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Every signal waits here for you. The advisory hint helps you decide - create it into the
            right record (it keeps its advisory score), or dismiss it.
          </p>
        </header>

        <form method="get" className="mb-6 flex items-center gap-2 text-sm text-zinc-500">
          <label htmlFor="minScore">Min advisory score</label>
          <input
            id="minScore"
            name="minScore"
            type="number"
            min={-1}
            max={5}
            defaultValue={minScore ?? ""}
            className="w-16 rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
          <button
            type="submit"
            className="rounded-md border border-zinc-200 px-3 py-1.5 text-sm dark:border-zinc-700"
          >
            Filter
          </button>
        </form>

        {items.length === 0 ? (
          <p className="rounded-lg border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900">
            Inbox zero - nothing waiting in the queue.
          </p>
        ) : (
          <ul className="space-y-3">
            {items.map((item) => (
              <QueueCard key={item.signalId} item={item} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function QueueCard({ item }: { item: TriageItem }) {
  return (
    <li className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{payloadName(item.payload)}</span>
          <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[11px] text-zinc-500 dark:bg-zinc-800">
            {item.kind}
          </span>
          <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-[11px] text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300">
            {item.advisoryKind ?? "advisory"} {item.advisoryScore ?? "-"}
          </span>
        </div>
      </div>
      {item.advisoryReason ? (
        <p className="mb-3 text-xs text-zinc-500">{item.advisoryReason}</p>
      ) : null}
      <div className="flex gap-2">
        <form action={approveAction}>
          <input type="hidden" name="id" value={item.signalId} />
          <button
            type="submit"
            className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            {createLabel(item.kind)}
          </button>
        </form>
        <form action={dismissAction}>
          <input type="hidden" name="id" value={item.signalId} />
          <button
            type="submit"
            className="rounded-md border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 dark:border-zinc-700 dark:text-zinc-400"
          >
            Dismiss
          </button>
        </form>
      </div>
    </li>
  );
}
