"use client";

// The unified Queue (anchor view) - the SOLE intake surface (ADR-0013/0019). Every
// signal awaits a human approve/dismiss; nothing is created at persist. Approval
// routes by kind to a Person / Company / peer+Post and promotes the advisory score.
// Client component on purpose: selection, filtering, decide-and-advance, and the
// keyboard triage are local UI state. Mock data only - nothing here creates a row.

import { useEffect, useMemo, useState } from "react";
import { pendingSignals, type PendingSignal } from "../_data/signals";
import { ScoreBadge } from "../_components/ScoreBadge";
import { SignalKindChip } from "../_components/SignalKindChip";
import { SourceChip } from "../_components/SourceChip";
import { SignalDetail } from "./_components/SignalDetail";
import type { SignalKind } from "../_data/types";

type Decision = "approved" | "dismissed";
type KindFilter = "all" | SignalKind;

const KIND_FILTERS: { value: KindFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "person", label: "People" },
  { value: "company", label: "Companies" },
  { value: "content", label: "Content" },
];

export default function QueuePage() {
  const [decided, setDecided] = useState<Record<string, Decision>>({});
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");
  const [selectedId, setSelectedId] = useState<string>(pendingSignals[0]?.id ?? "");

  const visible = useMemo(
    () =>
      pendingSignals.filter(
        (signal) => !decided[signal.id] && (kindFilter === "all" || signal.kind === kindFilter),
      ),
    [decided, kindFilter],
  );

  const selected = visible.find((signal) => signal.id === selectedId) ?? visible[0] ?? null;
  const decidedCount = Object.keys(decided).length;

  const advance = (justDecidedId: string) => {
    const idx = visible.findIndex((signal) => signal.id === justDecidedId);
    const next = visible[idx + 1] ?? visible[idx - 1] ?? null;
    if (next) setSelectedId(next.id);
  };

  const decide = (id: string, decision: Decision) => {
    advance(id);
    setDecided((prev) => ({ ...prev, [id]: decision }));
  };

  const step = (delta: number) => {
    if (!selected) return;
    const idx = visible.findIndex((signal) => signal.id === selected.id);
    const next = visible[idx + delta];
    if (next) setSelectedId(next.id);
  };

  // Keyboard triage: A approve, D dismiss, J/K navigate. The Queue has no text
  // inputs, so a global handler is safe here.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!selected) return;
      const key = event.key.toLowerCase();
      if (key === "a") decide(selected.id, "approved");
      else if (key === "d") decide(selected.id, "dismissed");
      else if (key === "j") step(1);
      else if (key === "k") step(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, visible]);

  return (
    <div className="flex flex-1 overflow-hidden">
      <section className="flex w-96 shrink-0 flex-col border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <header className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <div className="flex items-baseline justify-between">
            <h1 className="text-sm font-semibold">Queue</h1>
            <span className="text-xs text-zinc-500">{visible.length} pending</span>
          </div>
          <p className="mt-0.5 text-[11px] text-zinc-400">
            The sole intake. Every signal waits for you - no per-source bypass.
          </p>
          <div className="mt-2 inline-flex rounded-md border border-zinc-200 p-0.5 dark:border-zinc-700">
            {KIND_FILTERS.map((filter) => (
              <button
                key={filter.value}
                type="button"
                onClick={() => setKindFilter(filter.value)}
                className={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${
                  kindFilter === filter.value
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                    : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </header>
        <div className="flex-1 divide-y divide-zinc-100 overflow-y-auto dark:divide-zinc-800">
          {visible.map((signal) => (
            <SignalRow
              key={signal.id}
              signal={signal}
              selected={signal.id === selected?.id}
              onSelect={() => setSelectedId(signal.id)}
            />
          ))}
          {visible.length === 0 && (
            <div className="px-4 py-10 text-center">
              <p className="text-2xl" aria-hidden>
                ✓
              </p>
              <p className="mt-1 text-sm font-medium text-zinc-600 dark:text-zinc-300">
                Inbox zero
              </p>
              <p className="mt-1 text-xs text-zinc-400">
                {decidedCount > 0
                  ? `You triaged ${decidedCount} signal${decidedCount === 1 ? "" : "s"} this session. New ones arrive as scans finish.`
                  : "Nothing matches the filter."}
              </p>
            </div>
          )}
        </div>
      </section>

      <section className="flex-1 overflow-hidden bg-zinc-50 dark:bg-zinc-950">
        {selected ? (
          <SignalDetail
            key={selected.id}
            signal={selected}
            onApprove={() => decide(selected.id, "approved")}
            onDismiss={() => decide(selected.id, "dismissed")}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-zinc-400">
            Queue clear. Nothing to triage.
          </div>
        )}
      </section>
    </div>
  );
}

function SignalRow({
  signal,
  selected,
  onSelect,
}: {
  signal: PendingSignal;
  selected: boolean;
  onSelect: () => void;
}) {
  const name = signal.kind === "content" ? signal.payload.authorName : signal.payload.name;
  const sub =
    signal.kind === "person"
      ? `${signal.payload.headline}, ${signal.payload.company}`
      : signal.kind === "company"
        ? `${signal.payload.industry} · ${signal.payload.stage}`
        : signal.payload.authorHeadline;
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex w-full items-start gap-3 border-l-2 px-4 py-3 text-left transition-colors ${
        selected
          ? "border-zinc-900 bg-zinc-100 dark:border-zinc-100 dark:bg-zinc-800"
          : "border-transparent hover:bg-zinc-50 dark:hover:bg-zinc-900"
      }`}
    >
      <ScoreBadge score={signal.advisory.score} />
      <span className="min-w-0 flex-1">
        <span className="truncate text-sm font-medium">{name}</span>
        <span className="block truncate text-xs text-zinc-500">{sub}</span>
        <span className="mt-1.5 flex items-center gap-2">
          <SignalKindChip kind={signal.kind} />
          <SourceChip kind={signal.source} />
          <span className="text-[11px] text-zinc-400">{signal.capturedAt}</span>
        </span>
      </span>
    </button>
  );
}
