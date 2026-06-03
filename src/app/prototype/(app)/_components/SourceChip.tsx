import type { SourceKind } from "../_data/types";

const labels: Record<SourceKind, string> = {
  "linkedin-search": "LinkedIn",
  "x-posts": "X",
  "csv-companies": "CSV",
  news: "News",
};

const dot: Record<SourceKind, string> = {
  "linkedin-search": "bg-sky-500",
  "x-posts": "bg-zinc-900 dark:bg-zinc-100",
  "csv-companies": "bg-violet-500",
  news: "bg-orange-500",
};

export function SourceChip({ kind }: { kind: SourceKind }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
      <span className={`h-1.5 w-1.5 rounded-full ${dot[kind]}`} />
      {labels[kind]}
    </span>
  );
}
