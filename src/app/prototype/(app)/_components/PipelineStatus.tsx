"use client";

import { useState } from "react";
import type { PipelineStatusDef } from "../_data/pipeline";

// Person.status is a FK into the configurable pipeline (ADR-0020). The operator sets
// it directly; it never moves on its own. Colour
// is bucketed by position (full class strings so Tailwind's scan picks them up): the
// entry column is neutral, early outreach is sky, an active conversation is emerald,
// a terminal column is muted.
type Bucket = "entry" | "early" | "active" | "terminal";

const bucketStyles: Record<Bucket, string> = {
  entry: "bg-zinc-100 text-zinc-600 ring-zinc-500/20 dark:bg-zinc-800 dark:text-zinc-300",
  early: "bg-sky-100 text-sky-800 ring-sky-600/20 dark:bg-sky-500/15 dark:text-sky-300",
  active:
    "bg-emerald-100 text-emerald-800 ring-emerald-600/20 dark:bg-emerald-500/15 dark:text-emerald-300",
  terminal: "bg-zinc-50 text-zinc-400 ring-zinc-400/20 dark:bg-zinc-900 dark:text-zinc-500",
};

function bucketFor(status: PipelineStatusDef): Bucket {
  if (status.terminal) return "terminal";
  if (status.position === 0) return "entry";
  if (status.position >= 4) return "active";
  return "early";
}

export function PipelineStatusChip({ status }: { status: PipelineStatusDef }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${bucketStyles[bucketFor(status)]}`}
    >
      {status.name}
    </span>
  );
}

// A click-to-set picker. In the wired view this is a single Server Action writing
// Person.status; here it is local state. The operator can jump to any column at any
// time (ADR-0020), so this is a flat list, not a forced linear stepper.
export function PipelineStatusPicker({
  statuses,
  currentId,
  onChange,
}: {
  statuses: PipelineStatusDef[];
  currentId: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = statuses.find((status) => status.id === currentId) ?? statuses[0];
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex items-center gap-1.5 rounded-md border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        <PipelineStatusChip status={current} />
        <span className="text-zinc-400" aria-hidden>
          ▾
        </span>
      </button>
      {open && (
        <>
          <button
            type="button"
            aria-label="Close"
            className="fixed inset-0 z-10 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div className="absolute left-0 z-20 mt-1 w-48 rounded-lg border border-zinc-200 bg-white p-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
            {statuses.map((status) => (
              <button
                key={status.id}
                type="button"
                onClick={() => {
                  onChange(status.id);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800 ${
                  status.id === currentId ? "font-semibold" : "text-zinc-600 dark:text-zinc-300"
                }`}
              >
                <span className="w-4 font-mono text-[10px] text-zinc-400">{status.position}</span>
                {status.name}
                {status.id === currentId && (
                  <span className="ml-auto text-emerald-600 dark:text-emerald-400" aria-hidden>
                    ✓
                  </span>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
