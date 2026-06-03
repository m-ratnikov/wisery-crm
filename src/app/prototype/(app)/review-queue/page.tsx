"use client";

// Anchor view #2 mockup. Client component on purpose: the queue is inherently
// interactive - row selection, inline draft edits, filtering, and outcome logging
// are local UI state. No server data is wired in this prototype; it runs on the
// real Next 16 / Tailwind 4 stack with mock data so a settled design graduates
// straight into a wired anchor view.

import { useMemo, useState } from "react";
import { queuedProspects, type QueuedProspect } from "../_data/review-queue";
import { QueueRow } from "../_components/QueueRow";
import { QueueDetail } from "../_components/QueueDetail";

type MinScore = 0 | 4 | 5;

export default function QueuePage() {
  const [prospects, setProspects] = useState<QueuedProspect[]>(queuedProspects);
  const [selectedId, setSelectedId] = useState<string>(queuedProspects[0]?.id ?? "");
  const [minScore, setMinScore] = useState<MinScore>(0);
  const [hideActed, setHideActed] = useState(false);

  const visible = useMemo(
    () => prospects.filter((p) => p.score >= minScore && (!hideActed || p.outcome === "none")),
    [prospects, minScore, hideActed],
  );

  const selected = prospects.find((p) => p.id === selectedId) ?? visible[0] ?? null;
  // Distinguish "you've worked everything" from "the filter hid everything".
  const allActed = prospects.every((p) => p.outcome !== "none");

  const patch = (id: string, change: Partial<QueuedProspect>) =>
    setProspects((prev) => prev.map((p) => (p.id === id ? { ...p, ...change } : p)));

  const approveNext = () => {
    if (!selected) return;
    const idx = visible.findIndex((p) => p.id === selected.id);
    const next = visible[idx + 1] ?? visible[0];
    if (next) setSelectedId(next.id);
  };

  return (
    <div className="flex flex-1 overflow-hidden">
      <section className="flex w-80 shrink-0 flex-col border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <header className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <div className="flex items-baseline justify-between">
            <h1 className="text-sm font-semibold">Approve queue</h1>
            <span className="text-xs text-zinc-500">{visible.length} shown</span>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <ScoreFilter value={minScore} onChange={setMinScore} />
            <label className="ml-auto flex items-center gap-1.5 text-xs text-zinc-500">
              <input
                type="checkbox"
                checked={hideActed}
                onChange={(event) => setHideActed(event.target.checked)}
                className="accent-zinc-900 dark:accent-zinc-100"
              />
              Hide acted
            </label>
          </div>
        </header>
        <div className="flex-1 divide-y divide-zinc-100 overflow-y-auto dark:divide-zinc-800">
          {visible.map((p) => (
            <QueueRow
              key={p.id}
              prospect={p}
              selected={p.id === selected?.id}
              onSelect={() => setSelectedId(p.id)}
            />
          ))}
          {visible.length === 0 &&
            (allActed ? (
              <div className="px-4 py-10 text-center">
                <p className="text-2xl" aria-hidden>
                  ✓
                </p>
                <p className="mt-1 text-sm font-medium text-zinc-600 dark:text-zinc-300">
                  All caught up
                </p>
                <p className="mt-1 text-xs text-zinc-400">
                  You have actioned every prospect in the queue. New ones arrive as the pipeline
                  drafts them.
                </p>
              </div>
            ) : (
              <p className="px-4 py-8 text-center text-sm text-zinc-400">
                Nothing matches the filter.
              </p>
            ))}
        </div>
      </section>

      <section className="flex-1 overflow-hidden bg-zinc-50 dark:bg-zinc-950">
        {selected ? (
          <QueueDetail
            key={selected.id}
            prospect={selected}
            onDraftChange={(body) => patch(selected.id, { draft: { ...selected.draft, body } })}
            onOutcomeChange={(outcome) => patch(selected.id, { outcome })}
            onApproveNext={approveNext}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-zinc-400">
            Select a prospect.
          </div>
        )}
      </section>
    </div>
  );
}

function ScoreFilter({
  value,
  onChange,
}: {
  value: MinScore;
  onChange: (value: MinScore) => void;
}) {
  const options: { value: MinScore; label: string }[] = [
    { value: 0, label: "All" },
    { value: 4, label: "4+" },
    { value: 5, label: "5" },
  ];
  return (
    <div className="inline-flex rounded-md border border-zinc-200 p-0.5 dark:border-zinc-700">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${
            value === option.value
              ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
              : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
