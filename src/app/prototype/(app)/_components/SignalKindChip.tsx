import type { SignalKind } from "../_data/types";

// A signal's kind decides what approval creates (ADR-0013): a person signal -> a
// Person(prospect), a company signal -> a Company, a content signal -> the author as
// a Person(peer) + a Post. The chip teaches that routing at a glance.
const meta: Record<SignalKind, { label: string; dot: string; glyph: string }> = {
  person: { label: "Person", dot: "bg-sky-500", glyph: "◉" },
  company: { label: "Company", dot: "bg-violet-500", glyph: "▣" },
  content: { label: "Content", dot: "bg-orange-500", glyph: "❝" },
};

export function SignalKindChip({ kind }: { kind: SignalKind }) {
  const { label, dot, glyph } = meta[kind];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} aria-hidden />
      <span className="font-mono text-[10px] text-zinc-400" aria-hidden>
        {glyph}
      </span>
      {label}
    </span>
  );
}
