"use client";

// The Person workspace (anchor view) - where a person is worked after intake. Every
// substantive action here is ON DEMAND (ADR-0019): enrich, generate a message,
// generate a comment - each a synchronous click that writes one row, with LLM/Apify
// spend only on that click. Pipeline status is set directly (ADR-0020). The person
// carries no score - the advisory score stays on the originating signal (ADR-0022).
// Client component, mock data: the gestures mutate local state to show the
// affordance; nothing calls an LLM or sends.

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  getPerson,
  type DossierData,
  type Message,
  type OutcomeLog,
  type PersonDetail,
} from "../../_data/people";
import { postsForPerson, type FeedComment, type FeedPost } from "../../_data/feed";
import { pipelineStatuses } from "../../_data/pipeline";
import { SourceChip } from "../../_components/SourceChip";
import { PersonTypeChip } from "../../_components/PersonTypeChip";
import { PipelineStatusPicker } from "../../_components/PipelineStatus";
import type { MessageType, OutcomeResult } from "../../_data/types";

// All workspace state and the on-demand action gestures live in a hook so the page
// component stays a thin view. The gestures are wireframe-only: they mutate local
// state to show the affordance; nothing calls an LLM or sends.
function usePersonWorkspace(person: PersonDetail | undefined, id: string) {
  const [statusId, setStatusId] = useState(person?.statusId ?? "ps-cold");
  const [monitored, setMonitored] = useState(person?.monitored ?? false);
  const [dossier, setDossier] = useState<DossierData | null>(person?.dossier ?? null);
  const [messages, setMessages] = useState<Message[]>(person?.messages ?? []);
  const [outcomes, setOutcomes] = useState<OutcomeLog[]>(person?.outcomes ?? []);
  const [posts, setPosts] = useState<FeedPost[]>(() => postsForPerson(id));
  const [busy, setBusy] = useState<string | null>(null);

  const firstName = (person?.name ?? "there").split(" ")[0];

  const runBusy = (key: string, done: () => void) => {
    setBusy(key);
    window.setTimeout(() => {
      done();
      setBusy(null);
    }, 900);
  };

  const enrich = () =>
    runBusy("enrich", () =>
      setDossier({
        summary: `Generated dossier for ${person?.name ?? "this person"}: role history, company trajectory, and the inferred trigger behind the surfacing signal.`,
        highlights: [
          "Tenure and prior companies pulled from the profile",
          "Recent company funding / hiring activity",
          "Inferred buying trigger and the angle to lead with",
        ],
        links: [{ label: "LinkedIn profile", href: person?.linkedinUrl ?? "#" }],
        provider: "apify",
        enrichedAt: "just now",
      }),
    );

  const generateMessage = (type: MessageType) =>
    runBusy(`msg-${type}`, () =>
      setMessages((prev) => [
        {
          id: `msg-${Date.now()}`,
          type,
          body: messageBody(type, firstName),
          status: "generated",
          promptVersion: "message_v2",
          createdAt: "just now",
        },
        ...prev,
      ]),
    );

  const setMessageStatus = (id: string, status: Message["status"]) =>
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, status } : m)));

  const generateComment = (postId: string) =>
    runBusy(`cmt-${postId}`, () =>
      setPosts((prev) => prev.map((post) => (post.id === postId ? withNewComment(post) : post))),
    );

  const setCommentStatus = (postId: string, commentId: string, status: FeedComment["status"]) =>
    setPosts((prev) =>
      prev.map((post) => (post.id === postId ? withCommentStatus(post, commentId, status) : post)),
    );

  const logOutcome = (result: Exclude<OutcomeResult, "none">) =>
    setOutcomes((prev) => [
      {
        id: `out-${Date.now()}`,
        result,
        channel: "LinkedIn",
        occurredAt: "just now",
      },
      ...prev,
    ]);

  return {
    statusId,
    setStatusId,
    monitored,
    setMonitored,
    dossier,
    messages,
    outcomes,
    posts,
    busy,
    enrich,
    generateMessage,
    setMessageStatus,
    generateComment,
    setCommentStatus,
    logOutcome,
  };
}

function messageBody(type: MessageType, firstName: string): string {
  return type === "connection_request"
    ? `Hi ${firstName} - a short, personalized connection note grounded in the surfacing signal and your dossier would render here.`
    : `Hi ${firstName} - a follow-up DM, grounded in the prior touch and your dossier, would render here.`;
}

function withNewComment(post: FeedPost): FeedPost {
  return {
    ...post,
    comments: [
      {
        id: `cmt-${Date.now()}`,
        body: "A fresh AI comment grounded in this person's info and the global comment guidance would render here, ready for you to edit and post by hand.",
        status: "generated",
        promptVersion: "comment_v2",
        createdAt: "just now",
      },
      ...post.comments,
    ],
  };
}

function withCommentStatus(
  post: FeedPost,
  commentId: string,
  status: FeedComment["status"],
): FeedPost {
  return {
    ...post,
    comments: post.comments.map((c) => (c.id === commentId ? { ...c, status } : c)),
  };
}

export default function PersonWorkspacePage() {
  const params = useParams<{ id: string }>();
  const person = getPerson(params.id);
  const {
    statusId,
    setStatusId,
    monitored,
    setMonitored,
    dossier,
    messages,
    outcomes,
    posts,
    busy,
    enrich,
    generateMessage,
    setMessageStatus,
    generateComment,
    setCommentStatus,
    logOutcome,
  } = usePersonWorkspace(person, params.id);

  if (!person) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-sm text-zinc-500">
        <p>No such person in the mock dataset.</p>
        <Link href="/prototype/people" className="font-medium text-zinc-900 dark:text-zinc-100">
          Back to people &rarr;
        </Link>
      </div>
    );
  }

  const isProspect = person.type === "prospect";

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-[1700px] px-6 py-8 lg:px-10">
        <Link
          href="/prototype/people"
          className="text-xs text-zinc-500 underline-offset-2 hover:underline"
        >
          &larr; People
        </Link>

        {/* Header */}
        <header className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <PersonTypeChip type={person.type} />
              <SourceChip kind={person.source} />
              <span className="text-xs text-zinc-400">
                {person.origin === "manual" ? "Added by hand" : "From a signal"}
              </span>
            </div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">{person.name}</h1>
            <p className="text-sm text-zinc-500">
              {person.headline}
              {person.company && (
                <>
                  {" · "}
                  {person.companyId ? (
                    <Link
                      href={`/prototype/companies/${person.companyId}`}
                      className="underline-offset-2 hover:underline"
                    >
                      {person.company}
                    </Link>
                  ) : (
                    person.company
                  )}
                </>
              )}
              {" · "}
              {person.location}
            </p>
          </div>
          <a
            href={person.linkedinUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            Open in LinkedIn
          </a>
        </header>

        {/* Pipeline + monitor controls */}
        <div className="mt-4 flex flex-wrap items-center gap-4 rounded-lg border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
          <label className="flex items-center gap-2 text-xs text-zinc-500">
            <span className="font-medium text-zinc-700 dark:text-zinc-300">Pipeline</span>
            <PipelineStatusPicker
              statuses={pipelineStatuses}
              currentId={statusId}
              onChange={setStatusId}
            />
          </label>
          <span className="text-[11px] text-zinc-400">
            Status is set by you - the operator&apos;s column (ADR-0020).
          </span>
          <label className="ml-auto flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300">
            <input
              type="checkbox"
              checked={monitored}
              onChange={(event) => setMonitored(event.target.checked)}
              className="accent-zinc-900 dark:accent-zinc-100"
            />
            <span title="Monitored people's posts flow into the Feed">👁 Monitored</span>
          </label>
        </div>

        {/* On-demand action toolbar */}
        <div className="mt-3 flex flex-wrap gap-2">
          <ActionButton onClick={enrich} busy={busy === "enrich"} cost="1 Apify call">
            {dossier ? "Re-enrich" : "Enrich"}
          </ActionButton>
          <ActionButton
            onClick={() => generateMessage("connection_request")}
            busy={busy === "msg-connection_request"}
            cost="1 LLM call"
          >
            Generate CR
          </ActionButton>
          <ActionButton
            onClick={() => generateMessage("message")}
            busy={busy === "msg-message"}
            cost="1 LLM call"
          >
            Generate DM
          </ActionButton>
        </div>
        <p className="mt-1.5 text-[11px] text-zinc-400">
          Each is a synchronous on-demand action - one row written, spend only on the click. Nothing
          runs automatically in the background (ADR-0019).
        </p>

        {/* Section blocks fill the width as an adaptive masonry: one column on
            narrow screens, two from md, three from 2xl. Source order is preserved,
            so the mobile stack reads top-to-bottom and the cards just reflow. */}
        <div className="mt-5 columns-1 gap-5 md:columns-2 2xl:columns-3 [&>*]:mb-5 [&>*]:break-inside-avoid">
          <WhySurfaced person={person} />

          <DossierSection dossier={dossier} />

          {isProspect && (
            <MessagesSection
              messages={messages}
              onMarkSent={(id) => setMessageStatus(id, "sent")}
              onDismiss={(id) => setMessageStatus(id, "dismissed")}
            />
          )}

          <EngagementSection
            monitored={monitored}
            posts={posts}
            busy={busy}
            onGenerate={generateComment}
            onPost={(postId, commentId) => setCommentStatus(postId, commentId, "posted")}
            onDismiss={(postId, commentId) => setCommentStatus(postId, commentId, "dismissed")}
          />

          {isProspect && <OutcomesSection outcomes={outcomes} onLog={logOutcome} />}
        </div>
      </div>
    </div>
  );
}

function WhySurfaced({ person }: { person: PersonDetail }) {
  return (
    <Section title={person.origin === "manual" ? "Added manually" : "Why surfaced"}>
      {person.signal ? (
        <>
          <p className="text-xs text-zinc-400">
            {person.signal.label} · {person.signal.capturedAt}
          </p>
          <blockquote className="mt-2 border-l-2 border-zinc-200 pl-3 text-sm italic leading-6 text-zinc-600 dark:border-zinc-700 dark:text-zinc-300">
            {person.signal.excerpt}
          </blockquote>
        </>
      ) : (
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          Entered by hand, no signal - your call admitted them; there is no score anywhere
          (ADR-0022).
        </p>
      )}
    </Section>
  );
}

function DossierSection({ dossier }: { dossier: DossierData | null }) {
  return (
    <Section title="Research dossier" right={<ProviderTag dossier={dossier} />}>
      {dossier ? (
        <>
          <p className="text-sm leading-6 text-zinc-700 dark:text-zinc-300">{dossier.summary}</p>
          <ul className="mt-3 space-y-1.5">
            {dossier.highlights.map((highlight) => (
              <li key={highlight} className="flex gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                <span className="text-zinc-400" aria-hidden>
                  &bull;
                </span>
                {highlight}
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            {dossier.links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded border border-zinc-200 px-2 py-1 text-xs text-zinc-600 transition-colors hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-100"
              >
                {link.label} &nearr;
              </a>
            ))}
          </div>
        </>
      ) : (
        <p className="text-sm text-zinc-500">
          No dossier yet. Enrichment is optional and user-triggered - click <strong>Enrich</strong>{" "}
          above to deep-research this person (ADR-0007).
        </p>
      )}
    </Section>
  );
}

function MessagesSection({
  messages,
  onMarkSent,
  onDismiss,
}: {
  messages: Message[];
  onMarkSent: (id: string) => void;
  onDismiss: (id: string) => void;
}) {
  return (
    <Section title="LinkedIn messages">
      {messages.length === 0 ? (
        <p className="text-sm text-zinc-500">
          No messages yet. Generate a connection request or a DM above - each is a Message row,
          generated on demand and sent by you (ADR-0021, D2).
        </p>
      ) : (
        <ul className="space-y-3">
          {messages.map((message) => (
            <MessageCard
              key={message.id}
              message={message}
              onMarkSent={() => onMarkSent(message.id)}
              onDismiss={() => onDismiss(message.id)}
            />
          ))}
        </ul>
      )}
    </Section>
  );
}

function EngagementSection({
  monitored,
  posts,
  busy,
  onGenerate,
  onPost,
  onDismiss,
}: {
  monitored: boolean;
  posts: FeedPost[];
  busy: string | null;
  onGenerate: (postId: string) => void;
  onPost: (postId: string, commentId: string) => void;
  onDismiss: (postId: string, commentId: string) => void;
}) {
  const right = monitored ? (
    <Link
      href="/prototype/feed"
      className="text-xs font-medium text-zinc-500 underline-offset-2 hover:underline"
    >
      Open Feed &rarr;
    </Link>
  ) : undefined;
  return (
    <Section title="Engagement" right={right}>
      {!monitored ? (
        <p className="text-sm text-zinc-500">
          Not monitored. Toggle <strong>Monitored</strong> above to fetch this person&apos;s posts
          into the Feed and comment on them (ADR-0018).
        </p>
      ) : posts.length === 0 ? (
        <p className="text-sm text-zinc-500">
          Monitored, but no posts fetched yet. The activity scan pulls recent posts into the Feed.
        </p>
      ) : (
        <ul className="space-y-4">
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              busy={busy === `cmt-${post.id}`}
              onGenerate={() => onGenerate(post.id)}
              onPost={(commentId) => onPost(post.id, commentId)}
              onDismiss={(commentId) => onDismiss(post.id, commentId)}
            />
          ))}
        </ul>
      )}
    </Section>
  );
}

function OutcomesSection({
  outcomes,
  onLog,
}: {
  outcomes: OutcomeLog[];
  onLog: (result: Exclude<OutcomeResult, "none">) => void;
}) {
  return (
    <Section title="Outcomes">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-zinc-500">Log the result of a manual touch:</span>
        {(["connected", "replied", "booked", "no_response"] as const).map((result) => (
          <button
            key={result}
            type="button"
            onClick={() => onLog(result)}
            className="rounded border border-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            {result.replace("_", " ")}
          </button>
        ))}
      </div>
      {outcomes.length > 0 && (
        <ul className="mt-3 space-y-1.5 border-t border-zinc-100 pt-3 dark:border-zinc-800">
          {outcomes.map((outcome) => (
            <li key={outcome.id} className="flex items-center gap-3 text-xs">
              <span className="font-medium text-emerald-600 dark:text-emerald-400">
                {outcome.result.replace("_", " ")}
              </span>
              <span className="text-zinc-400">
                {outcome.channel} · {outcome.occurredAt}
              </span>
              {outcome.notes && <span className="truncate text-zinc-500">{outcome.notes}</span>}
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function ActionButton({
  onClick,
  busy,
  cost,
  children,
}: {
  onClick: () => void;
  busy: boolean;
  cost: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      title={`On-demand action - ${cost}`}
      className="inline-flex items-center gap-1.5 rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
    >
      {busy ? "Working..." : children}
      <span className="rounded bg-zinc-100 px-1 font-mono text-[10px] text-zinc-400 dark:bg-zinc-800">
        {cost}
      </span>
    </button>
  );
}

function MessageCard({
  message,
  onMarkSent,
  onDismiss,
}: {
  message: Message;
  onMarkSent: () => void;
  onDismiss: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    void navigator.clipboard?.writeText(message.body);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };
  const dimmed = message.status === "dismissed";
  return (
    <li
      className={`rounded-md border border-zinc-200 p-3 dark:border-zinc-800 ${dimmed ? "opacity-50" : ""}`}
    >
      <div className="mb-2 flex items-center gap-2">
        <span className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[10px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
          {message.type === "connection_request" ? "Connection request" : "DM"}
        </span>
        <StatusPill status={message.status} />
        <span className="ml-auto font-mono text-[10px] text-zinc-400">{message.promptVersion}</span>
      </div>
      <p className="text-sm leading-6 text-zinc-700 dark:text-zinc-300">{message.body}</p>
      {message.status === "generated" && (
        <div className="mt-2 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onDismiss}
            className="rounded px-2 py-1 text-xs text-zinc-400 transition-colors hover:text-zinc-700 dark:hover:text-zinc-200"
          >
            Dismiss
          </button>
          <button
            type="button"
            onClick={copy}
            className="rounded border border-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-600 transition-colors hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-300 dark:hover:text-zinc-100"
          >
            {copied ? "Copied" : "Copy"}
          </button>
          <button
            type="button"
            onClick={onMarkSent}
            className="rounded bg-zinc-900 px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            Mark sent
          </button>
        </div>
      )}
    </li>
  );
}

function PostCard({
  post,
  busy,
  onGenerate,
  onPost,
  onDismiss,
}: {
  post: FeedPost;
  busy: boolean;
  onGenerate: () => void;
  onPost: (commentId: string) => void;
  onDismiss: (commentId: string) => void;
}) {
  return (
    <li className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-zinc-400">{post.postedAt}</span>
        <a
          href={post.externalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-zinc-500 underline-offset-2 hover:underline"
        >
          Open post &nearr;
        </a>
      </div>
      <p className="mt-1.5 text-sm leading-6 text-zinc-700 dark:text-zinc-300">{post.content}</p>
      <div className="mt-3 space-y-2">
        {post.comments.map((comment) => (
          <div
            key={comment.id}
            className={`rounded border border-zinc-100 bg-zinc-50 p-2.5 dark:border-zinc-800 dark:bg-zinc-900/50 ${comment.status === "dismissed" ? "opacity-50" : ""}`}
          >
            <div className="mb-1 flex items-center gap-2">
              <StatusPill status={comment.status} />
              <span className="ml-auto font-mono text-[10px] text-zinc-400">
                {comment.promptVersion}
              </span>
            </div>
            <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-300">{comment.body}</p>
            {comment.status === "generated" && (
              <div className="mt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => onDismiss(comment.id)}
                  className="rounded px-2 py-0.5 text-xs text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                >
                  Dismiss
                </button>
                <button
                  type="button"
                  onClick={() => onPost(comment.id)}
                  className="rounded bg-zinc-900 px-2.5 py-0.5 text-xs font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
                >
                  Mark posted
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={onGenerate}
        disabled={busy}
        className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
      >
        {busy ? "Generating..." : "Generate comment"}
        <span className="rounded bg-zinc-100 px-1 font-mono text-[10px] text-zinc-400 dark:bg-zinc-800">
          1 LLM call
        </span>
      </button>
    </li>
  );
}

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    generated: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
    sent: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
    posted: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
    dismissed: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
  };
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${styles[status] ?? styles.dismissed}`}
    >
      {status}
    </span>
  );
}

function ProviderTag({ dossier }: { dossier: DossierData | null }) {
  if (!dossier) return null;
  return (
    <span className="font-mono text-[10px] text-zinc-400">
      {dossier.provider} · {dossier.enrichedAt}
    </span>
  );
}

function Section({
  title,
  right,
  children,
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}
