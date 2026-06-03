import type { ProspectStatus } from "../_data/types";

// Full class strings per status so Tailwind's source scan picks them up (no
// dynamically assembled class names) - the same discipline as ScoreBadge. The
// colour climbs from neutral (early/de-emphasised) to emerald (ready to act).
const styles: Record<ProspectStatus, string> = {
  new: "bg-zinc-100 text-zinc-600 ring-zinc-500/20 dark:bg-zinc-800 dark:text-zinc-300",
  below_bar: "bg-zinc-50 text-zinc-400 ring-zinc-400/20 dark:bg-zinc-900 dark:text-zinc-500",
  qualified: "bg-sky-100 text-sky-800 ring-sky-600/20 dark:bg-sky-500/15 dark:text-sky-300",
  queued:
    "bg-emerald-100 text-emerald-800 ring-emerald-600/20 dark:bg-emerald-500/15 dark:text-emerald-300",
  acted: "bg-green-100 text-green-800 ring-green-600/20 dark:bg-green-500/15 dark:text-green-300",
  dismissed: "bg-zinc-50 text-zinc-400 ring-zinc-400/20 dark:bg-zinc-900 dark:text-zinc-500",
  closed: "bg-zinc-100 text-zinc-500 ring-zinc-500/20 dark:bg-zinc-800 dark:text-zinc-400",
};

const labels: Record<ProspectStatus, string> = {
  new: "New",
  below_bar: "Below bar",
  qualified: "Qualified",
  queued: "Queued",
  acted: "Acted",
  dismissed: "Dismissed",
  closed: "Closed",
};

export function StatusBadge({ status }: { status: ProspectStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}

// The derived facets (ADR-0008): a Dossier / a selected Draft exists. Orthogonal to
// disposition and able to co-occur, so they render as their own small chips next to
// the status, not as statuses.
export function FacetChips({ enriched, drafted }: { enriched: boolean; drafted: boolean }) {
  if (!enriched && !drafted) return null;
  return (
    <span className="inline-flex items-center gap-1">
      {enriched && (
        <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium text-violet-700 ring-1 ring-inset ring-violet-600/20 dark:text-violet-300">
          Enriched
        </span>
      )}
      {drafted && (
        <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20 dark:text-amber-300">
          Drafted
        </span>
      )}
    </span>
  );
}
