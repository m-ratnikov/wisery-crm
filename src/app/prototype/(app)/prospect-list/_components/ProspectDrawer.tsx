import Link from "next/link";
import { formatAge, type ProspectRow } from "../../_data/prospect-list";
import { ScoreBadge } from "../../_components/ScoreBadge";
import { FacetChips, StatusBadge } from "../../_components/StatusBadge";
import { SourceChip } from "../../_components/SourceChip";

// Slide-over detail for a single prospect. The list is a manage surface, so the
// only act-style affordance is a deep link into the approve queue (anchor #2) for
// prospects that have reached it; the queue, not the list, is where the human acts.
export function ProspectDrawer({
  prospect,
  onClose,
  onDismiss,
}: {
  prospect: ProspectRow | null;
  onClose: () => void;
  onDismiss: (id: string) => void;
}) {
  if (!prospect) return null;

  const inQueue = prospect.status === "queued";
  const dismissable = !["dismissed", "closed", "acted"].includes(prospect.status);

  return (
    <>
      <button
        type="button"
        aria-label="Close detail"
        onClick={onClose}
        className="absolute inset-0 z-20 bg-zinc-900/20 dark:bg-zinc-950/40"
      />
      <aside className="absolute inset-y-0 right-0 z-30 flex w-[28rem] max-w-[90%] flex-col border-l border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
        <header className="flex items-start justify-between gap-3 border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
          <div className="flex items-start gap-3">
            {prospect.score === null ? (
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-lg text-zinc-300 dark:bg-zinc-800 dark:text-zinc-600">
                &ndash;
              </span>
            ) : (
              <ScoreBadge score={prospect.score} size="lg" />
            )}
            <div>
              <h2 className="text-base font-semibold tracking-tight">{prospect.name}</h2>
              <p className="text-sm text-zinc-500">
                {prospect.title}, {prospect.company}
              </p>
              <p className="text-xs text-zinc-400">{prospect.location}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            aria-label="Close"
          >
            ✕
          </button>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <div className="flex items-center gap-2">
            <StatusBadge status={prospect.status} />
            <FacetChips enriched={prospect.enriched} drafted={prospect.drafted} />
            {prospect.result && (
              <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                Outcome: {prospect.result}
              </span>
            )}
            <span className="ml-auto text-xs text-zinc-400">
              updated {formatAge(prospect.ageHours)}
            </span>
          </div>

          <p className="rounded-md bg-zinc-100 px-4 py-3 text-sm leading-6 text-zinc-600 dark:bg-zinc-950 dark:text-zinc-300">
            <span className="font-medium text-zinc-900 dark:text-zinc-100">
              {prospect.score === null ? "Not scored yet:" : `Why score ${prospect.score}:`}
            </span>{" "}
            {prospect.scoreReason}
          </p>

          <Section title="Why surfaced">
            <div className="flex items-center gap-2">
              <SourceChip kind={prospect.source} />
              <span className="text-xs text-zinc-500">{prospect.signalLabel}</span>
            </div>
            <blockquote className="mt-2 border-l-2 border-zinc-200 pl-3 text-sm italic leading-6 text-zinc-600 dark:border-zinc-700 dark:text-zinc-300">
              {prospect.signalExcerpt}
            </blockquote>
          </Section>

          {prospect.dossierSummary && (
            <Section title="Research dossier">
              <p className="text-sm leading-6 text-zinc-700 dark:text-zinc-300">
                {prospect.dossierSummary}
              </p>
            </Section>
          )}

          {prospect.tags.length > 0 && (
            <Section title="Tags">
              <div className="flex flex-wrap gap-1.5">
                {prospect.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </Section>
          )}
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-zinc-200 px-6 py-4 dark:border-zinc-800">
          {dismissable ? (
            <button
              type="button"
              onClick={() => onDismiss(prospect.id)}
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-400 dark:hover:bg-zinc-800"
            >
              Dismiss
            </button>
          ) : (
            <span />
          )}
          {inQueue ? (
            <Link
              href="/prototype/review-queue"
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              Review in approve queue &rarr;
            </Link>
          ) : (
            <span className="text-xs text-zinc-400">Not in the approve queue yet</span>
          )}
        </footer>
      </aside>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">{title}</h3>
      {children}
    </section>
  );
}
