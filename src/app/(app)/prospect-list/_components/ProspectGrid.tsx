"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  addLeadAction,
  batchEnrichAction,
  enrichAction,
  setAutoEnrichAction,
  setStatusAction,
} from "../actions";

export interface GridItem {
  id: string;
  name: string;
  // The pipeline position (a pipeline_status name, ADR-0020); operator-set.
  status: string;
  origin: string;
  sourceKind: string;
  enriched: boolean;
}

export interface StatusOption {
  id: string;
  name: string;
}

const inputClass =
  "w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950";

// Anchor view #3: the browse/manage grid. Client component for filtering, multi-select, and
// the batch enrich + auto-enrich-toggle gestures (the toggle persists the setting but routes
// nothing today, reserved for auto-enrich-on-approval); each mutation is a Server-Action form. enriched is a derived
// facet from the read-model (ADR-0008), shown as a badge - not a status. The pipeline statuses
// (ADR-0020) drive the filter and the per-row status-setter. No score or qualification appears
// here - the advisory score lives on the signal in the Queue (ADR-0022).
export function ProspectGrid({
  items,
  statuses,
  autoEnrich,
}: {
  items: GridItem[];
  statuses: StatusOption[];
  autoEnrich: boolean;
}) {
  const [status, setStatus] = useState<string>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);

  const rows = useMemo(
    () => items.filter((i) => status === "all" || i.status === status),
    [items, status],
  );

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        >
          <option value="all">All statuses</option>
          {statuses.map((s) => (
            <option key={s.id} value={s.name}>
              {s.name}
            </option>
          ))}
        </select>
        <form action={batchEnrichAction} className="ml-auto">
          {[...selected].map((id) => (
            <input key={id} type="hidden" name="id" value={id} />
          ))}
          <button
            type="submit"
            disabled={selected.size === 0}
            className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
          >
            Enrich selected ({selected.size})
          </button>
        </form>

        <form action={setAutoEnrichAction}>
          <input type="hidden" name="autoEnrich" value={(!autoEnrich).toString()} />
          <button
            type="submit"
            className="rounded-md border border-zinc-200 px-3 py-1.5 text-sm dark:border-zinc-700"
          >
            Auto-enrich: {autoEnrich ? "On" : "Off"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => setAdding((v) => !v)}
          className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          {adding ? "Cancel" : "Add lead"}
        </button>
      </div>

      {adding ? (
        <form
          action={addLeadAction}
          className="grid gap-3 rounded-lg border border-zinc-200 bg-white p-4 sm:grid-cols-2 dark:border-zinc-800 dark:bg-zinc-900"
        >
          <p className="text-xs text-zinc-500 sm:col-span-2">
            Add a known person by hand. They enter the pipeline at its first status (no signal
            needed).
          </p>
          <input name="name" required placeholder="Name (required)" className={inputClass} />
          <input name="headline" placeholder="Headline / title" className={inputClass} />
          <input name="company" placeholder="Company" className={inputClass} />
          <input name="linkedinUrl" placeholder="LinkedIn URL" className={inputClass} />
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
            >
              Add lead
            </button>
          </div>
        </form>
      ) : null}

      <table className="w-full text-sm">
        <thead className="text-left text-xs uppercase tracking-wide text-zinc-400">
          <tr>
            <th className="w-8 py-2"></th>
            <th className="py-2">Person</th>
            <th className="py-2">Status</th>
            <th className="py-2">Source</th>
            <th className="py-2">Facets</th>
            <th className="py-2">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {rows.map((i) => (
            <tr key={i.id}>
              <td className="py-2">
                <input
                  type="checkbox"
                  checked={selected.has(i.id)}
                  onChange={() => toggle(i.id)}
                  aria-label={`select ${i.name}`}
                />
              </td>
              <td className="py-2">
                <Link href={`/prospect-list/${i.id}`} className="font-medium hover:underline">
                  {i.name}
                </Link>
              </td>
              <td className="py-2">
                {/* Status-setter (ADR-0020): submit on change moves the person to a pipeline status.
                    The composite FK guarantees the chosen status belongs to this pipeline. */}
                <form action={setStatusAction}>
                  <input type="hidden" name="id" value={i.id} />
                  <select
                    name="statusId"
                    defaultValue={statuses.find((s) => s.name === i.status)?.id ?? ""}
                    onChange={(e) => e.currentTarget.form?.requestSubmit()}
                    aria-label={`status for ${i.name}`}
                    className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-950"
                  >
                    {statuses.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </form>
              </td>
              <td className="py-2 text-zinc-500">{i.sourceKind}</td>
              <td className="py-2 text-xs">
                {i.enriched ? <span className="text-emerald-600">enriched</span> : null}
              </td>
              <td className="py-2">
                <form action={enrichAction}>
                  <input type="hidden" name="id" value={i.id} />
                  <button
                    type="submit"
                    className="text-xs text-zinc-600 hover:text-zinc-900 dark:text-zinc-400"
                  >
                    Enrich
                  </button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-zinc-500">No person match the filter.</p>
      ) : null}
    </div>
  );
}
