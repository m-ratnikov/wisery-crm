import { ScoreBadge } from "../../_components/ScoreBadge";
import { SourceChip } from "../../_components/SourceChip";
import { SignalKindChip } from "../../_components/SignalKindChip";
import type { PendingSignal } from "../../_data/signals";

// Per-kind approval routing (ADR-0013). The label tells the operator exactly what
// entity the click creates, so "approve" is never ambiguous.
const approveMeta: Record<PendingSignal["kind"], { label: string; creates: string }> = {
  person: { label: "Create person", creates: "a Person (type prospect) in the pipeline at Cold" },
  company: {
    label: "Create company",
    creates: "a Company",
  },
  content: {
    label: "Track author + post",
    creates: "the author as a Person (type peer) plus the Post",
  },
};

export function SignalDetail({
  signal,
  onApprove,
  onDismiss,
}: {
  signal: PendingSignal;
  onApprove: () => void;
  onDismiss: () => void;
}) {
  const meta = approveMeta[signal.kind];

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-4 border-b border-zinc-200 bg-white px-8 py-5 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-start gap-4">
          <ScoreBadge score={signal.advisory.score} size="lg" />
          <div>
            <div className="flex items-center gap-2">
              <SignalKindChip kind={signal.kind} />
              <SourceChip kind={signal.source} />
              <span className="text-xs text-zinc-400">{signal.capturedAt}</span>
            </div>
            <h2 className="mt-1.5 text-lg font-semibold tracking-tight">{titleOf(signal)}</h2>
            <p className="text-sm text-zinc-500">{subtitleOf(signal)}</p>
          </div>
        </div>
      </div>

      {/* Metadata on the left, the source-preview "market square" filling the rest.
          Stacks to one column below xl. */}
      <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-8 py-6 xl:flex-row">
        <div className="space-y-5 xl:w-[26rem] xl:shrink-0">
          <div className="rounded-md bg-zinc-100 px-4 py-3 text-sm leading-6 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
            <span className="font-medium text-zinc-900 dark:text-zinc-100">
              Advisory hint{" "}
              {signal.advisory.score === null
                ? "(none)"
                : signal.advisory.score === -1
                  ? "(insufficient data)"
                  : `(${signal.advisory.score}/5, ${signal.advisory.rubricKind} rubric)`}
              :
            </span>{" "}
            {signal.advisory.reason}
            <p className="mt-2 text-xs italic text-zinc-400">
              A hint only - it never auto-decides. You approve or dismiss (ADR-0017).
            </p>
          </div>

          <Section title="Signal payload">{renderPayload(signal)}</Section>

          <Section title="What approval does">
            <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-300">
              Approve creates {meta.creates} - nothing else. The advisory score stays here on the
              signal; your verdict is the qualification (ADR-0022).
              {signal.kind === "company" ? " Expansion to people is deferred (M2)." : ""}
            </p>
          </Section>
        </div>

        <div className="min-h-[22rem] flex-1 xl:min-h-0">
          <SourcePreview signal={signal} />
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 border-t border-zinc-200 bg-white px-8 py-4 dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-xs text-zinc-400">
          <kbd className="rounded border border-zinc-300 px-1 font-mono dark:border-zinc-600">
            A
          </kbd>{" "}
          approve &middot;{" "}
          <kbd className="rounded border border-zinc-300 px-1 font-mono dark:border-zinc-600">
            D
          </kbd>{" "}
          dismiss &middot;{" "}
          <kbd className="rounded border border-zinc-300 px-1 font-mono dark:border-zinc-600">
            J
          </kbd>
          /
          <kbd className="rounded border border-zinc-300 px-1 font-mono dark:border-zinc-600">
            K
          </kbd>{" "}
          navigate
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Dismiss
          </button>
          <button
            type="button"
            onClick={onApprove}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            {meta.label}
          </button>
        </div>
      </div>
    </div>
  );
}

function titleOf(signal: PendingSignal): string {
  if (signal.kind === "person") return signal.payload.name;
  if (signal.kind === "company") return signal.payload.name;
  return signal.payload.authorName;
}

function subtitleOf(signal: PendingSignal): string {
  if (signal.kind === "person") {
    return `${signal.payload.headline}, ${signal.payload.company} · ${signal.payload.location}`;
  }
  if (signal.kind === "company") {
    return `${signal.payload.industry} · ${signal.payload.stage} · ${signal.payload.location}`;
  }
  return signal.payload.authorHeadline;
}

function renderPayload(signal: PendingSignal) {
  if (signal.kind === "person") {
    const p = signal.payload;
    return (
      <div className="space-y-3">
        <Field label="Name" value={p.name} />
        <Field label="Headline" value={p.headline} />
        <Field label="Company" value={p.company} />
        <Field label="Location" value={p.location} />
        <Quote label="Why surfaced">{p.context}</Quote>
        <ExternalLink href={p.linkedinUrl}>Open profile</ExternalLink>
      </div>
    );
  }
  if (signal.kind === "company") {
    const c = signal.payload;
    return (
      <div className="space-y-3">
        <Field label="Company" value={c.name} />
        {c.domain && <Field label="Domain" value={c.domain} />}
        <Field label="Industry" value={c.industry} />
        <Field label="Stage" value={c.stage} />
        <Field label="Location" value={c.location} />
        <Quote label="Note">{c.note}</Quote>
      </div>
    );
  }
  const c = signal.payload;
  return (
    <div className="space-y-3">
      <Field label="Author" value={c.authorName} />
      <Field label="About" value={c.authorHeadline} />
      <Field label="Posted" value={c.postedAt} />
      <Quote label="Post">{c.postExcerpt}</Quote>
      <div className="flex flex-wrap gap-2">
        <ExternalLink href={c.authorUrl}>Author profile</ExternalLink>
        <ExternalLink href={c.postUrl}>Open post</ExternalLink>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3 text-sm">
      <span className="w-24 shrink-0 text-zinc-400">{label}</span>
      <span className="text-zinc-700 dark:text-zinc-200">{value}</span>
    </div>
  );
}

function Quote({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="text-sm">
      <span className="text-zinc-400">{label}</span>
      <blockquote className="mt-1 border-l-2 border-zinc-200 pl-3 italic leading-6 text-zinc-600 dark:border-zinc-700 dark:text-zinc-300">
        {children}
      </blockquote>
    </div>
  );
}

function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex rounded border border-zinc-200 px-2 py-1 text-xs text-zinc-600 transition-colors hover:border-zinc-300 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-100"
    >
      {children} &nearr;
    </a>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">{title}</h3>
      {children}
    </section>
  );
}

// The source-preview "market square": a faux browser frame wrapping a render of the
// SCRAPED content, not a live <iframe>. LinkedIn and X block framing (X-Frame-Options /
// frame-ancestors) and sit behind a login, so the live page cannot be embedded; in the
// real app this renders a snapshot captured server-side at scan time (ADR-0002). Here it
// renders the mock payload to show the intended UX. The "Open" button is the live escape
// hatch - the human opens the real page in a new tab and acts there (D2).
function SourcePreview({ signal }: { signal: PendingSignal }) {
  const url = previewUrl(signal);
  const gated = signal.source === "linkedin-search" || signal.source === "x-posts";
  return (
    <section className="flex h-full min-h-[22rem] flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center gap-2 border-b border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950">
        <span className="flex gap-1" aria-hidden>
          <span className="h-2.5 w-2.5 rounded-full bg-zinc-300 dark:bg-zinc-600" />
          <span className="h-2.5 w-2.5 rounded-full bg-zinc-300 dark:bg-zinc-600" />
          <span className="h-2.5 w-2.5 rounded-full bg-zinc-300 dark:bg-zinc-600" />
        </span>
        <span className="flex min-w-0 flex-1 items-center gap-1.5 rounded bg-white px-2 py-1 text-xs text-zinc-500 ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-700">
          <span aria-hidden>{gated ? "🔒" : "🌐"}</span>
          <span className="truncate">{url ?? "no public URL for this signal"}</span>
        </span>
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 rounded border border-zinc-200 px-2 py-1 text-xs font-medium text-zinc-600 transition-colors hover:border-zinc-300 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            Open &nearr;
          </a>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-6">{renderSnapshot(signal)}</div>

      <div className="border-t border-zinc-100 px-3 py-2 text-[11px] italic leading-5 text-zinc-400 dark:border-zinc-800">
        Rendered from the snapshot captured at scan time. The live page is not embedded - LinkedIn
        and X block framing and sit behind a login, so the human opens the source to act (D2).
      </div>
    </section>
  );
}

function previewUrl(signal: PendingSignal): string | null {
  if (signal.kind === "person") return signal.payload.linkedinUrl;
  if (signal.kind === "content") return signal.payload.postUrl;
  return signal.payload.domain ? `https://${signal.payload.domain}` : null;
}

function renderSnapshot(signal: PendingSignal) {
  if (signal.kind === "person") {
    const p = signal.payload;
    return (
      <div className="mx-auto max-w-xl space-y-4">
        <div className="flex items-center gap-3">
          <Avatar name={p.name} />
          <div>
            <p className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{p.name}</p>
            <p className="text-sm text-zinc-500">
              {p.headline} · {p.company}
            </p>
            <p className="text-xs text-zinc-400">{p.location}</p>
          </div>
        </div>
        <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
            Recent activity
          </p>
          <p className="mt-1.5 whitespace-pre-line text-sm leading-7 text-zinc-700 dark:text-zinc-300">
            {p.context}
          </p>
        </div>
      </div>
    );
  }
  if (signal.kind === "content") {
    const c = signal.payload;
    return (
      <div className="mx-auto max-w-xl space-y-4">
        <div className="flex items-center gap-3">
          <Avatar name={c.authorName} />
          <div>
            <p className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              {c.authorName}
            </p>
            <p className="text-sm text-zinc-500">{c.authorHeadline}</p>
            <p className="text-xs text-zinc-400">{c.postedAt}</p>
          </div>
        </div>
        <p className="whitespace-pre-line text-sm leading-7 text-zinc-700 dark:text-zinc-300">
          {c.postExcerpt}
        </p>
      </div>
    );
  }
  const c = signal.payload;
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div className="flex items-center gap-3">
        <span
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-lg font-semibold text-violet-700 dark:bg-violet-500/15 dark:text-violet-300"
          aria-hidden
        >
          {c.name.charAt(0)}
        </span>
        <div>
          <p className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{c.name}</p>
          <p className="text-sm text-zinc-500">
            {c.industry} · {c.stage}
          </p>
          <p className="text-xs text-zinc-400">
            {c.location}
            {c.domain ? ` · ${c.domain}` : ""}
          </p>
        </div>
      </div>
      <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">About</p>
        <p className="mt-1.5 text-sm leading-7 text-zinc-700 dark:text-zinc-300">{c.note}</p>
      </div>
    </div>
  );
}

function Avatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .map((part) => part.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <span
      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-sky-100 text-base font-semibold text-sky-700 dark:bg-sky-500/15 dark:text-sky-300"
      aria-hidden
    >
      {initials}
    </span>
  );
}
