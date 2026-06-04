import type { Metadata } from "next";
import { listQueue, type QueueItem } from "@/lib/queue/read";
import { actAction, dismissAction, logOutcomeAction } from "./actions";

// Anchor view #2, wired (review-queue): the highest-judgment surface. Each card shows the
// dossier signal, the selected draft, and an assisted-action link; the human acts manually
// (the system never sends, D2) and logs the outcome against the score (D7). Server Component;
// mutations are Server Actions.
//
// D1: authorization is deferred (single-user MVP); the actions are unauthenticated by design.

export const metadata: Metadata = {
  title: "Review queue - Wisery CRM",
};

const RESULTS = ["connected", "replied", "booked", "no_response"] as const;

export default async function ReviewQueuePage() {
  const items = await listQueue();

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      <div className="mx-auto w-full max-w-2xl px-8 py-10">
        <header className="mb-6">
          <h1 className="text-lg font-semibold tracking-tight">Review &amp; approve</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Review the draft, act on the channel yourself (we never send), then log what happened.
          </p>
        </header>

        {items.length === 0 ? (
          <p className="rounded-lg border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900">
            All caught up - nothing waiting for review.
          </p>
        ) : (
          <ul className="space-y-4">
            {items.map((item) => (
              <QueueCard key={item.id} item={item} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function QueueCard({ item }: { item: QueueItem }) {
  return (
    <li className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{item.name}</span>
          <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[11px] text-zinc-500 dark:bg-zinc-800">
            score {item.score ?? "-"}
          </span>
          {item.enriched ? (
            <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[11px] text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
              enriched
            </span>
          ) : null}
          <span className="text-[11px] text-zinc-400">{item.status}</span>
        </div>
        <a
          href="https://www.linkedin.com/feed/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400"
        >
          Open LinkedIn &#8599;
        </a>
      </div>

      {item.reason ? <p className="mb-3 text-xs text-zinc-500">{item.reason}</p> : null}

      <div className="mb-4 rounded-md bg-zinc-50 p-3 text-sm leading-6 whitespace-pre-wrap dark:bg-zinc-950">
        {item.draft ?? "No draft."}
      </div>

      {item.status === "queued" ? (
        <div className="flex gap-2">
          <form action={actAction}>
            <input type="hidden" name="id" value={item.id} />
            <button
              type="submit"
              className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
            >
              I sent it (mark acted)
            </button>
          </form>
          <form action={dismissAction}>
            <input type="hidden" name="id" value={item.id} />
            <button
              type="submit"
              className="rounded-md border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 dark:border-zinc-700 dark:text-zinc-400"
            >
              Dismiss
            </button>
          </form>
        </div>
      ) : (
        <form action={logOutcomeAction} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="id" value={item.id} />
          <span className="text-xs text-zinc-500">Outcome:</span>
          {RESULTS.map((r) => (
            <button
              key={r}
              type="submit"
              name="result"
              value={r}
              className="rounded-md border border-zinc-200 px-2.5 py-1 text-xs text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              {r.replace("_", " ")}
            </button>
          ))}
        </form>
      )}
    </li>
  );
}
