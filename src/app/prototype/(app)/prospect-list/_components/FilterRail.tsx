import type { ProspectStatus, SourceKind } from "../../_data/types";
import { StatusBadge } from "../../_components/StatusBadge";
import { SourceChip } from "../../_components/SourceChip";

export type MinScore = "all" | 3 | 4 | 5;

const scoreOptions: { value: MinScore; label: string }[] = [
  { value: "all", label: "All" },
  { value: 3, label: "3+" },
  { value: 4, label: "4+" },
  { value: 5, label: "5" },
];

export function FilterRail({
  search,
  onSearch,
  minScore,
  onMinScore,
  statuses,
  activeStatuses,
  onToggleStatus,
  sources,
  activeSources,
  onToggleSource,
  tags,
  activeTag,
  onTag,
  shown,
  total,
  onReset,
}: {
  search: string;
  onSearch: (value: string) => void;
  minScore: MinScore;
  onMinScore: (value: MinScore) => void;
  statuses: ProspectStatus[];
  activeStatuses: Set<ProspectStatus>;
  onToggleStatus: (status: ProspectStatus) => void;
  sources: SourceKind[];
  activeSources: Set<SourceKind>;
  onToggleSource: (source: SourceKind) => void;
  tags: string[];
  activeTag: string | null;
  onTag: (tag: string | null) => void;
  shown: number;
  total: number;
  onReset: () => void;
}) {
  const filtered = shown !== total;
  return (
    <aside className="flex w-60 shrink-0 flex-col gap-5 overflow-y-auto border-r border-zinc-200 bg-white px-4 py-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div>
        <input
          type="search"
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          placeholder="Search name or company"
          className="w-full rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm outline-none placeholder:text-zinc-400 focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:focus:border-zinc-500"
        />
      </div>

      <FilterGroup label="ICP score">
        <div className="inline-flex rounded-md border border-zinc-200 p-0.5 dark:border-zinc-700">
          {scoreOptions.map((option) => (
            <button
              key={String(option.value)}
              type="button"
              onClick={() => onMinScore(option.value)}
              className={`rounded px-2.5 py-0.5 text-xs font-medium transition-colors ${
                minScore === option.value
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </FilterGroup>

      <FilterGroup label="Status">
        <div className="flex flex-wrap gap-1.5">
          {statuses.map((status) => {
            const active = activeStatuses.size === 0 || activeStatuses.has(status);
            return (
              <button
                key={status}
                type="button"
                onClick={() => onToggleStatus(status)}
                className={`transition-opacity ${active ? "opacity-100" : "opacity-35 hover:opacity-70"}`}
                aria-pressed={active}
              >
                <StatusBadge status={status} />
              </button>
            );
          })}
        </div>
      </FilterGroup>

      <FilterGroup label="Source">
        <div className="flex flex-wrap gap-1.5">
          {sources.map((source) => {
            const active = activeSources.size === 0 || activeSources.has(source);
            return (
              <button
                key={source}
                type="button"
                onClick={() => onToggleSource(source)}
                className={`transition-opacity ${active ? "opacity-100" : "opacity-35 hover:opacity-70"}`}
                aria-pressed={active}
              >
                <SourceChip kind={source} />
              </button>
            );
          })}
        </div>
      </FilterGroup>

      <FilterGroup label="Tag">
        <select
          value={activeTag ?? ""}
          onChange={(event) => onTag(event.target.value || null)}
          className="w-full rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:focus:border-zinc-500"
        >
          <option value="">All tags</option>
          {tags.map((tag) => (
            <option key={tag} value={tag}>
              {tag}
            </option>
          ))}
        </select>
      </FilterGroup>

      <div className="mt-auto flex items-center justify-between border-t border-zinc-200 pt-3 text-xs text-zinc-500 dark:border-zinc-800">
        <span>
          {shown} of {total} shown
        </span>
        {filtered && (
          <button
            type="button"
            onClick={onReset}
            className="font-medium text-zinc-600 underline-offset-2 hover:underline dark:text-zinc-400"
          >
            Reset
          </button>
        )}
      </div>
    </aside>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">{label}</p>
      {children}
    </div>
  );
}
