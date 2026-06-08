import type { Metadata } from "next";
import { listTriage, type TriageItem } from "@/lib/triage/read";
import { approveAction, dismissAction } from "./actions";

// The Queue triage lane (universal-triage, ADR-0013): every pending signal awaits a human
// approve/dismiss, annotated with an advisory hint. Approval routes by kind into the right entity;
// the review/approve queue (the send lane) is the separate post-pipeline surface. Server Component.
export const metadata: Metadata = {
  title: "Triage - Wisery CRM",
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

export default async function TriagePage() {
  const items = await listTriage();

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      <div className="mx-auto w-full max-w-2xl px-8 py-10">
        <header className="mb-6">
          <h1 className="text-lg font-semibold tracking-tight">Triage</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Every signal waits here for you. The advisory hint helps you decide - approve it into
            the right record, or dismiss it.
          </p>
        </header>

        {items.length === 0 ? (
          <p className="rounded-lg border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900">
            Inbox zero - nothing waiting for triage.
          </p>
        ) : (
          <ul className="space-y-3">
            {items.map((item) => (
              <TriageCard key={item.signalId} item={item} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function TriageCard({ item }: { item: TriageItem }) {
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
            Approve
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
