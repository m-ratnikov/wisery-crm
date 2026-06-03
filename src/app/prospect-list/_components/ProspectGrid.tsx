"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  batchEnrichAction,
  enrichAction,
  regenerateDraftAction,
  setAutoEnrichAction,
} from "../actions";

export interface GridItem {
  id: string;
  name: string;
  status: string;
  score: number | null;
  summary: string | null;
  sourceKind: string;
  enriched: boolean;
  drafted: boolean;
}

const STATUSES = ["new", "below_bar", "qualified", "queued", "acted", "dismissed", "closed"];

// Anchor view #3: the browse/manage grid. Client component for filtering, multi-select, and
// the batch/auto-enrich gestures; each mutation is a Server-Action form. enriched/drafted are
// derived facets from the read-model (ADR-0008), shown as badges - not statuses.
export function ProspectGrid({ items, autoEnrich }: { items: GridItem[]; autoEnrich: boolean }) {
  const [status, setStatus] = useState<string>("all");
  const [minScore, setMinScore] = useState<number>(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const rows = useMemo(
    () =>
      items.filter((i) => (status === "all" || i.status === status) && (i.score ?? 0) >= minScore),
    [items, status, minScore],
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
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-zinc-500">
          min score
          <input
            type="number"
            min={0}
            max={5}
            value={minScore}
            onChange={(e) => setMinScore(Number(e.target.value))}
            className="w-16 rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
        </label>

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
      </div>

      <table className="w-full text-sm">
        <thead className="text-left text-xs uppercase tracking-wide text-zinc-400">
          <tr>
            <th className="w-8 py-2"></th>
            <th className="py-2">Prospect</th>
            <th className="py-2">Score</th>
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
                {i.summary ? <p className="truncate text-xs text-zinc-500">{i.summary}</p> : null}
              </td>
              <td className="py-2">{i.score ?? "-"}</td>
              <td className="py-2">{i.status}</td>
              <td className="py-2 text-zinc-500">{i.sourceKind}</td>
              <td className="py-2 text-xs">
                {i.enriched ? <span className="mr-1 text-emerald-600">enriched</span> : null}
                {i.drafted ? <span className="text-blue-600">drafted</span> : null}
              </td>
              <td className="py-2">
                <div className="flex gap-2">
                  <form action={enrichAction}>
                    <input type="hidden" name="id" value={i.id} />
                    <button
                      type="submit"
                      className="text-xs text-zinc-600 hover:text-zinc-900 dark:text-zinc-400"
                    >
                      Enrich
                    </button>
                  </form>
                  <form action={regenerateDraftAction}>
                    <input type="hidden" name="id" value={i.id} />
                    <button
                      type="submit"
                      className="text-xs text-zinc-600 hover:text-zinc-900 dark:text-zinc-400"
                    >
                      Regenerate
                    </button>
                  </form>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-zinc-500">No prospects match the filter.</p>
      ) : null}
    </div>
  );
}
