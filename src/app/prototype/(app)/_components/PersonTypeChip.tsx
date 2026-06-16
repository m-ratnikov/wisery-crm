import type { PersonType } from "../_data/types";

// A person is a buyer (prospect) or an amplifier (peer); one identity carries both
// the type and the monitored facet (ADR-0015). The chip distinguishes the two
// motions: prospects run the outreach funnel, peers run the engagement/feed motion.
const meta: Record<PersonType, { label: string; cls: string }> = {
  prospect: {
    label: "Prospect",
    cls: "bg-sky-100 text-sky-800 ring-sky-600/20 dark:bg-sky-500/15 dark:text-sky-300",
  },
  peer: {
    label: "Peer",
    cls: "bg-violet-100 text-violet-800 ring-violet-600/20 dark:bg-violet-500/15 dark:text-violet-300",
  },
};

export function PersonTypeChip({ type }: { type: PersonType }) {
  const { label, cls } = meta[type];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${cls}`}
    >
      {label}
    </span>
  );
}
