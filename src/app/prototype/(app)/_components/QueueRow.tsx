import type { QueuedProspect } from "../_data/review-queue";
import { ScoreBadge } from "./ScoreBadge";
import { SourceChip } from "./SourceChip";

export function QueueRow({
  prospect,
  selected,
  onSelect,
}: {
  prospect: QueuedProspect;
  selected: boolean;
  onSelect: () => void;
}) {
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
      <ScoreBadge score={prospect.score} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-medium">{prospect.name}</span>
          {prospect.outcome !== "none" && (
            <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
              {prospect.outcome}
            </span>
          )}
        </span>
        <span className="block truncate text-xs text-zinc-500">
          {prospect.title}, {prospect.company}
        </span>
        <span className="mt-1.5 flex items-center gap-2">
          <SourceChip kind={prospect.signal.kind} />
          <span className="text-[11px] text-zinc-400">{prospect.signal.capturedAt}</span>
        </span>
      </span>
    </button>
  );
}
