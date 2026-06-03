import type { Dispatch, SetStateAction } from "react";
import type { ScanStatus, SourceConfig } from "../../_data/icp-config";
import type { SourceKind } from "../../_data/types";
import { SourceChip } from "../../_components/SourceChip";
import { ConfigSection } from "./ConfigSection";

const scanStyles: Record<ScanStatus, string> = {
  completed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  failed: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",
  running: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
};

// Configured signal sources (D8): a source is config-as-data, and adding one is a
// connector kind plus a query, never a pipeline change. Edits and scans are local
// to the prototype - nothing actually fetches.
export function SourceManager({
  sources,
  setSources,
}: {
  sources: SourceConfig[];
  setSources: Dispatch<SetStateAction<SourceConfig[]>>;
}) {
  const patch = (id: string, change: Partial<SourceConfig>) =>
    setSources((prev) =>
      prev.map((source) => (source.id === id ? { ...source, ...change } : source)),
    );

  const addSource = () =>
    setSources((prev) => [
      ...prev,
      {
        id: `s-new-${prev.length + 1}`,
        kind: "linkedin-search",
        name: "New source",
        query: "",
        enabled: false,
        schedule: "Manual",
      },
    ]);

  const scanNow = (id: string) => {
    patch(id, {
      lastScan: { at: "just now", status: "running", fetched: 0, persisted: 0, dropped: 0 },
    });
    window.setTimeout(() => {
      const fetched = 20 + Math.floor(Math.random() * 30);
      const persisted = Math.floor(fetched * 0.3);
      patch(id, {
        lastScan: {
          at: "just now",
          status: "completed",
          fetched,
          persisted,
          dropped: fetched - persisted,
        },
      });
    }, 1200);
  };

  return (
    <ConfigSection
      title="Signal sources"
      description="The top of the funnel (D3, D8). Each source is a connector kind plus a query - a new source is a new adapter, not a new pipeline."
      action={
        <button
          type="button"
          onClick={addSource}
          className="shrink-0 rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          + Add source
        </button>
      }
    >
      <div className="space-y-3">
        {sources.map((source) => (
          <div
            key={source.id}
            className={`rounded-md border p-4 transition-opacity ${
              source.enabled
                ? "border-zinc-200 dark:border-zinc-800"
                : "border-dashed border-zinc-200 opacity-60 dark:border-zinc-800"
            }`}
          >
            <div className="flex items-center gap-3">
              <SourceChip kind={source.kind} />
              <input
                value={source.name}
                onChange={(event) => patch(source.id, { name: event.target.value })}
                className="flex-1 rounded-md border border-transparent bg-transparent px-1 py-0.5 text-sm font-medium outline-none hover:border-zinc-200 focus:border-zinc-400 dark:hover:border-zinc-700 dark:focus:border-zinc-500"
              />
              <KindSelect value={source.kind} onChange={(kind) => patch(source.id, { kind })} />
              <Toggle on={source.enabled} onChange={(enabled) => patch(source.id, { enabled })} />
            </div>

            <input
              value={source.query}
              placeholder="Search query, terms, or uploaded file"
              onChange={(event) => patch(source.id, { query: event.target.value })}
              className="mt-3 w-full rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 font-mono text-xs outline-none placeholder:text-zinc-400 focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:focus:border-zinc-500"
            />

            <div className="mt-3 flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 text-zinc-500">
                <span>{source.schedule}</span>
                {source.lastScan && (
                  <>
                    <span aria-hidden>&middot;</span>
                    <span
                      className={`rounded px-1.5 py-0.5 font-medium ${scanStyles[source.lastScan.status]}`}
                    >
                      {source.lastScan.status}
                    </span>
                    {source.lastScan.status === "failed" ? (
                      <span className="flex items-center gap-2 text-red-600 dark:text-red-400">
                        {source.lastScan.error}
                        <button
                          type="button"
                          onClick={() => scanNow(source.id)}
                          className="shrink-0 rounded border border-red-300 px-2 py-0.5 font-medium text-red-700 transition-colors hover:bg-red-50 dark:border-red-500/40 dark:text-red-300 dark:hover:bg-red-500/10"
                        >
                          Re-link session
                        </button>
                      </span>
                    ) : (
                      <span>
                        {source.lastScan.at}: {source.lastScan.fetched} fetched,{" "}
                        {source.lastScan.persisted} new, {source.lastScan.dropped} duplicate
                      </span>
                    )}
                  </>
                )}
              </div>
              <button
                type="button"
                disabled={!source.enabled || source.lastScan?.status === "running"}
                onClick={() => scanNow(source.id)}
                className="shrink-0 rounded border border-zinc-300 px-2.5 py-1 font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                {source.lastScan?.status === "running" ? "Scanning..." : "Scan now"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </ConfigSection>
  );
}

const kindLabels: Record<SourceKind, string> = {
  "linkedin-search": "LinkedIn search",
  "x-posts": "X posts",
  "csv-companies": "CSV of companies",
  news: "News / alerts",
};

// People-first MVP: only the person scrapers are selectable. Company-list and news
// scrapers expand to people (normalize-expand, roadmap M2) and are disabled as V2.
const v2Kinds = new Set<SourceKind>(["csv-companies", "news"]);

function KindSelect({
  value,
  onChange,
}: {
  value: SourceKind;
  onChange: (kind: SourceKind) => void;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value as SourceKind)}
      className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:focus:border-zinc-500"
    >
      {(Object.keys(kindLabels) as SourceKind[]).map((kind) => (
        <option key={kind} value={kind} disabled={v2Kinds.has(kind)}>
          {kindLabels[kind]}
          {v2Kinds.has(kind) ? " (V2)" : ""}
        </option>
      ))}
    </select>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: (on: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
        on ? "bg-emerald-500" : "bg-zinc-300 dark:bg-zinc-700"
      }`}
    >
      <span
        className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
          on ? "translate-x-4" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}
