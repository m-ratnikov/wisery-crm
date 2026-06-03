import { useState } from "react";
import type { Outcome, QueuedProspect } from "../_data/review-queue";
import { ScoreBadge } from "./ScoreBadge";
import { SourceChip } from "./SourceChip";
import { OutcomeBar } from "./OutcomeBar";

export function QueueDetail({
  prospect,
  onDraftChange,
  onOutcomeChange,
  onApproveNext,
}: {
  prospect: QueuedProspect;
  onDraftChange: (body: string) => void;
  onOutcomeChange: (outcome: Outcome) => void;
  onApproveNext: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const copyDraft = () => {
    void navigator.clipboard?.writeText(prospect.draft.body);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  // Wireframe gesture: a real regenerate calls the drafting job again (a fresh
  // prompt_version). Here it just shows the affordance; nothing calls an LLM.
  const regenerate = () => {
    setRegenerating(true);
    window.setTimeout(() => setRegenerating(false), 1200);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-4 border-b border-zinc-200 bg-white px-8 py-5 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-start gap-4">
          <ScoreBadge score={prospect.score} size="lg" />
          <div>
            <h2 className="text-lg font-semibold tracking-tight">{prospect.name}</h2>
            <p className="text-sm text-zinc-500">
              {prospect.title}, {prospect.company} &middot; {prospect.location}
            </p>
          </div>
        </div>
        <a
          href={prospect.actionUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          Open in LinkedIn
        </a>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto px-8 py-6">
        <p className="rounded-md bg-zinc-100 px-4 py-3 text-sm leading-6 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
          <span className="font-medium text-zinc-900 dark:text-zinc-100">
            Why score {prospect.score}:
          </span>{" "}
          {prospect.scoreReason}
        </p>

        <Section title="Why surfaced">
          <div className="flex items-center gap-2">
            <SourceChip kind={prospect.signal.kind} />
            <span className="text-xs text-zinc-500">
              {prospect.signal.label} &middot; {prospect.signal.capturedAt}
            </span>
          </div>
          <blockquote className="mt-3 border-l-2 border-zinc-200 pl-3 text-sm italic leading-6 text-zinc-600 dark:border-zinc-700 dark:text-zinc-300">
            {prospect.signal.excerpt}
          </blockquote>
        </Section>

        <Section title="Research dossier">
          <p className="text-sm leading-6 text-zinc-700 dark:text-zinc-300">
            {prospect.dossier.summary}
          </p>
          <ul className="mt-3 space-y-1.5">
            {prospect.dossier.highlights.map((highlight) => (
              <li key={highlight} className="flex gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                <span className="text-zinc-400" aria-hidden>
                  &bull;
                </span>
                {highlight}
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            {prospect.dossier.links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded border border-zinc-200 px-2 py-1 text-xs text-zinc-600 transition-colors hover:border-zinc-300 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-100"
              >
                {link.label}
              </a>
            ))}
          </div>
        </Section>

        <Section
          title="First-touch draft"
          rightSlot={
            <span className="rounded bg-zinc-100 px-2 py-0.5 font-mono text-[11px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
              {prospect.draft.channel} &middot; prompt {prospect.draft.promptVersion}
            </span>
          }
        >
          <textarea
            value={prospect.draft.body}
            onChange={(event) => onDraftChange(event.target.value)}
            rows={5}
            className="w-full resize-y rounded-md border border-zinc-200 bg-white p-3 text-sm leading-6 text-zinc-800 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:focus:border-zinc-500"
          />
          <div className="mt-2 flex items-center justify-between">
            <p className="text-xs text-zinc-400">
              Assisted send - copy this, open the profile, and send it yourself. Wisery never sends
              (D2).
            </p>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={regenerate}
                disabled={regenerating}
                className="rounded border border-zinc-200 px-3 py-1 text-xs font-medium text-zinc-600 transition-colors hover:text-zinc-900 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-100"
              >
                {regenerating ? "Regenerating..." : "Regenerate"}
              </button>
              <button
                type="button"
                onClick={copyDraft}
                className="rounded border border-zinc-200 px-3 py-1 text-xs font-medium text-zinc-600 transition-colors hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-100"
              >
                {copied ? "Copied" : "Copy draft"}
              </button>
            </div>
          </div>
        </Section>
      </div>

      <div className="flex items-center justify-between gap-4 border-t border-zinc-200 bg-white px-8 py-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center gap-3">
          <span className="text-xs text-zinc-500">Outcome, logged vs. the score (D7)</span>
          <OutcomeBar value={prospect.outcome} onChange={onOutcomeChange} />
        </div>
        <button
          type="button"
          onClick={onApproveNext}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          Next prospect
        </button>
      </div>
    </div>
  );
}

function Section({
  title,
  rightSlot,
  children,
}: {
  title: string;
  rightSlot?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">{title}</h3>
        {rightSlot}
      </div>
      {children}
    </section>
  );
}
