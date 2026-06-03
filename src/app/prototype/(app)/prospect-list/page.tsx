"use client";

// Anchor view #3 mockup - the broad browse/manage surface over the whole pipeline.
// Client component on purpose: filtering, sorting, row selection, the detail
// slide-over, and the dismiss action are all local UI state. No server data is
// wired; it runs on the real Next 16 / Tailwind 4 stack with mock data so a settled
// design graduates straight into a wired anchor view.

import { useMemo, useState } from "react";
import type { ProspectStatus, SourceKind } from "../_data/types";
import { prospects as seed, type ProspectRow } from "../_data/prospect-list";
import { FilterRail, type MinScore } from "./_components/FilterRail";
import { ProspectTable, type SortDir, type SortKey } from "./_components/ProspectTable";
import { ProspectDrawer } from "./_components/ProspectDrawer";

// Canonical disposition order (domain-model.md, ADR-0008) so the status filter reads as
// the pipeline. Enriched/drafted are facets, not statuses - filtered separately if needed.
const STATUS_ORDER: ProspectStatus[] = [
  "new",
  "below_bar",
  "qualified",
  "queued",
  "acted",
  "dismissed",
  "closed",
];
const SOURCE_ORDER: SourceKind[] = ["linkedin-search", "x-posts", "csv-companies", "news"];

const defaultDir: Record<SortKey, SortDir> = { name: "asc", score: "desc", age: "asc" };

// null (unscored) sorts below the -1 insufficient sentinel.
const scoreRank = (score: ProspectRow["score"]) => (score === null ? -2 : score);

export default function ProspectListPage() {
  const [rows, setRows] = useState<ProspectRow[]>(seed);
  const [search, setSearch] = useState("");
  const [minScore, setMinScore] = useState<MinScore>("all");
  const [activeStatuses, setActiveStatuses] = useState<Set<ProspectStatus>>(new Set());
  const [activeSources, setActiveSources] = useState<Set<SourceKind>>(new Set());
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("score");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const statuses = useMemo(
    () => STATUS_ORDER.filter((status) => rows.some((row) => row.status === status)),
    [rows],
  );
  const sources = useMemo(
    () => SOURCE_ORDER.filter((source) => rows.some((row) => row.source === source)),
    [rows],
  );
  const tags = useMemo(
    () => Array.from(new Set(rows.flatMap((row) => row.tags))).sort((a, b) => a.localeCompare(b)),
    [rows],
  );

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = rows.filter((row) => {
      if (query && !`${row.name} ${row.company} ${row.title}`.toLowerCase().includes(query)) {
        return false;
      }
      if (minScore !== "all" && !(row.score !== null && row.score >= minScore)) return false;
      if (activeStatuses.size > 0 && !activeStatuses.has(row.status)) return false;
      if (activeSources.size > 0 && !activeSources.has(row.source)) return false;
      if (activeTag && !row.tags.includes(activeTag)) return false;
      return true;
    });

    const direction = sortDir === "asc" ? 1 : -1;
    return filtered.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name") cmp = a.name.localeCompare(b.name);
      else if (sortKey === "score") cmp = scoreRank(a.score) - scoreRank(b.score);
      else cmp = a.ageHours - b.ageHours;
      return cmp * direction;
    });
  }, [rows, search, minScore, activeStatuses, activeSources, activeTag, sortKey, sortDir]);

  const selected = selectedId ? (rows.find((row) => row.id === selectedId) ?? null) : null;

  const toggle = <T,>(set: Set<T>, value: T): Set<T> => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    return next;
  };

  const onSort = (key: SortKey) => {
    if (key === sortKey) setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir(defaultDir[key]);
    }
  };

  const reset = () => {
    setSearch("");
    setMinScore("all");
    setActiveStatuses(new Set());
    setActiveSources(new Set());
    setActiveTag(null);
  };

  const dismiss = (id: string) =>
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, status: "dismissed" } : row)));

  return (
    <div className="relative flex flex-1 overflow-hidden">
      <FilterRail
        search={search}
        onSearch={setSearch}
        minScore={minScore}
        onMinScore={setMinScore}
        statuses={statuses}
        activeStatuses={activeStatuses}
        onToggleStatus={(status) => setActiveStatuses((prev) => toggle(prev, status))}
        sources={sources}
        activeSources={activeSources}
        onToggleSource={(source) => setActiveSources((prev) => toggle(prev, source))}
        tags={tags}
        activeTag={activeTag}
        onTag={setActiveTag}
        shown={visible.length}
        total={rows.length}
        onReset={reset}
      />

      <section className="flex flex-1 flex-col overflow-hidden bg-white dark:bg-zinc-950">
        <header className="flex items-baseline justify-between border-b border-zinc-200 px-6 py-3 dark:border-zinc-800">
          <h1 className="text-sm font-semibold">Prospects</h1>
          <span className="text-xs text-zinc-500">
            Every prospect, every stage. Click a row for the dossier.
          </span>
        </header>
        <ProspectTable
          rows={visible}
          selectedId={selectedId}
          onSelect={setSelectedId}
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={onSort}
        />
      </section>

      <ProspectDrawer prospect={selected} onClose={() => setSelectedId(null)} onDismiss={dismiss} />
    </div>
  );
}
