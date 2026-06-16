import type { AdvisoryScore, Score } from "../_data/types";

// Full class strings per score so Tailwind's source scan picks them up (no
// dynamically assembled class names).
const styles: Record<Score, string> = {
  5: "bg-emerald-100 text-emerald-800 ring-emerald-600/20 dark:bg-emerald-500/15 dark:text-emerald-300",
  4: "bg-green-100 text-green-800 ring-green-600/20 dark:bg-green-500/15 dark:text-green-300",
  3: "bg-amber-100 text-amber-800 ring-amber-600/20 dark:bg-amber-500/15 dark:text-amber-300",
  2: "bg-zinc-100 text-zinc-600 ring-zinc-500/20 dark:bg-zinc-800 dark:text-zinc-300",
  1: "bg-zinc-100 text-zinc-600 ring-zinc-500/20 dark:bg-zinc-800 dark:text-zinc-300",
};

// The -1 anti-hallucination sentinel renders as "?"; an absent score (no active
// rubric of the signal's kind, ADR-0019) renders as a muted dash.
const mutedStyle = "bg-zinc-50 text-zinc-400 ring-zinc-400/20 dark:bg-zinc-900 dark:text-zinc-500";

export function ScoreBadge({ score, size = "sm" }: { score: AdvisoryScore; size?: "sm" | "lg" }) {
  const dims = size === "lg" ? "h-10 w-10 text-lg" : "h-6 w-6 text-xs";
  const absent = score === null;
  const insufficient = score === -1;
  const muted = absent || insufficient;
  const title = absent
    ? "No advisory score - no active rubric of this kind"
    : insufficient
      ? "Insufficient data to score"
      : `ICP score ${score} of 5`;
  return (
    <span
      title={title}
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold ring-1 ring-inset ${dims} ${
        muted ? mutedStyle : styles[score]
      }`}
    >
      {absent ? "–" : insufficient ? "?" : score}
    </span>
  );
}
