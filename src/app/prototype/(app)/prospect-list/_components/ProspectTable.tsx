import { formatAge, type ProspectRow } from "../../_data/prospect-list";
import { ScoreBadge } from "../../_components/ScoreBadge";
import { FacetChips, StatusBadge } from "../../_components/StatusBadge";
import { SourceChip } from "../../_components/SourceChip";

export type SortKey = "name" | "score" | "age";
export type SortDir = "asc" | "desc";

export function ProspectTable({
  rows,
  selectedId,
  onSelect,
  sortKey,
  sortDir,
  onSort,
}: {
  rows: ProspectRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (key: SortKey) => void;
}) {
  if (rows.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-zinc-400">
        No prospects match the filters.
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto">
      <table className="w-full border-collapse text-sm">
        <thead className="sticky top-0 z-10 bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-400 dark:bg-zinc-950">
          <tr className="border-b border-zinc-200 dark:border-zinc-800">
            <SortableTh
              label="Prospect"
              col="name"
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={onSort}
            />
            <th className="px-4 py-2.5 font-semibold">Company</th>
            <SortableTh
              label="Score"
              col="score"
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={onSort}
            />
            <th className="px-4 py-2.5 font-semibold">Status</th>
            <th className="px-4 py-2.5 font-semibold">Source</th>
            <th className="px-4 py-2.5 font-semibold">Tags</th>
            <SortableTh
              label="Updated"
              col="age"
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={onSort}
            />
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {rows.map((row) => (
            <tr
              key={row.id}
              onClick={() => onSelect(row.id)}
              className={`cursor-pointer transition-colors ${
                row.id === selectedId
                  ? "bg-zinc-100 dark:bg-zinc-800"
                  : "hover:bg-zinc-50 dark:hover:bg-zinc-900"
              }`}
            >
              <td className="px-4 py-2.5">
                <div className="font-medium text-zinc-900 dark:text-zinc-100">{row.name}</div>
                <div className="text-xs text-zinc-500">{row.title}</div>
              </td>
              <td className="px-4 py-2.5 text-zinc-600 dark:text-zinc-300">{row.company}</td>
              <td className="px-4 py-2.5">
                {row.score === null ? (
                  <span className="text-zinc-300 dark:text-zinc-600" title="Not scored yet">
                    &ndash;
                  </span>
                ) : (
                  <ScoreBadge score={row.score} />
                )}
              </td>
              <td className="px-4 py-2.5">
                <span className="flex flex-wrap items-center gap-1">
                  <StatusBadge status={row.status} />
                  <FacetChips enriched={row.enriched} drafted={row.drafted} />
                </span>
              </td>
              <td className="px-4 py-2.5">
                <SourceChip kind={row.source} />
              </td>
              <td className="px-4 py-2.5">
                <TagCells tags={row.tags} />
              </td>
              <td className="whitespace-nowrap px-4 py-2.5 text-xs text-zinc-400">
                {formatAge(row.ageHours)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SortableTh({
  label,
  col,
  sortKey,
  sortDir,
  onSort,
}: {
  label: string;
  col: SortKey;
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (key: SortKey) => void;
}) {
  const active = sortKey === col;
  return (
    <th className="px-4 py-2.5 font-semibold">
      <button
        type="button"
        onClick={() => onSort(col)}
        className={`inline-flex items-center gap-1 uppercase tracking-wide transition-colors hover:text-zinc-700 dark:hover:text-zinc-200 ${
          active ? "text-zinc-700 dark:text-zinc-200" : ""
        }`}
      >
        {label}
        <span aria-hidden className={active ? "opacity-100" : "opacity-0"}>
          {sortDir === "asc" ? "▲" : "▼"}
        </span>
      </button>
    </th>
  );
}

function TagCells({ tags }: { tags: string[] }) {
  if (tags.length === 0) return <span className="text-zinc-300 dark:text-zinc-600">&ndash;</span>;
  const shown = tags.slice(0, 2);
  const extra = tags.length - shown.length;
  return (
    <span className="flex flex-wrap items-center gap-1">
      {shown.map((tag) => (
        <span
          key={tag}
          className="rounded bg-zinc-100 px-1.5 py-0.5 text-[11px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
        >
          {tag}
        </span>
      ))}
      {extra > 0 && <span className="text-[11px] text-zinc-400">+{extra}</span>}
    </span>
  );
}
