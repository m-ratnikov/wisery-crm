"use client";

// The Feed (anchor view) - the engagement analog of the Queue (ADR-0018). Instead of
// triaging signals into entities, you triage monitored people's posts into AI-drafted
// comments that you edit and post by hand (D2). A post accrues many Comment drafts
// (regenerable); several "generated" drafts may coexist, you post one and dismiss the
// rest. Client component, mock data: nothing posts to LinkedIn.

import { useMemo, useState } from "react";
import Link from "next/link";
import { feedPosts as seed, type FeedComment, type FeedPost } from "../_data/feed";
import { PersonTypeChip } from "../_components/PersonTypeChip";

// Global comment guidance (ADR-0018) - the tone and rules every generated comment is
// grounded in. Shown so the operator sees what shaped the draft.
const commentGuidance = {
  tone: "Peer-to-peer, specific, never salesy. Add a concrete idea, not praise.",
  rules: [
    "Lead with a specific reaction to the post, not a compliment",
    "At most one light reference to your own experience",
    "Never pitch or mention services",
    "Keep it to 2-3 sentences",
  ],
};

type PostFilter = "all" | "needs-comment";

export default function FeedPage() {
  const [posts, setPosts] = useState<FeedPost[]>(seed);
  const [filter, setFilter] = useState<PostFilter>("all");
  const [selectedId, setSelectedId] = useState<string>(seed[0]?.id ?? "");

  const needsComment = (post: FeedPost) =>
    !post.comments.some((comment) => comment.status === "posted");

  const visible = useMemo(
    () => posts.filter((post) => filter === "all" || needsComment(post)),
    [posts, filter],
  );

  const selected = posts.find((post) => post.id === selectedId) ?? visible[0] ?? null;

  const mutateComments = (postId: string, fn: (comments: FeedComment[]) => FeedComment[]) =>
    setPosts((prev) =>
      prev.map((post) => (post.id === postId ? { ...post, comments: fn(post.comments) } : post)),
    );

  return (
    <div className="flex flex-1 overflow-hidden">
      <section className="flex w-96 shrink-0 flex-col border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <header className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <div className="flex items-baseline justify-between">
            <h1 className="text-sm font-semibold">Feed</h1>
            <span className="text-xs text-zinc-500">{visible.length} posts</span>
          </div>
          <p className="mt-0.5 text-[11px] text-zinc-400">
            Posts from monitored people. Comment by hand - nothing auto-posts (D2).
          </p>
          <div className="mt-2 inline-flex rounded-md border border-zinc-200 p-0.5 dark:border-zinc-700">
            {(["all", "needs-comment"] as PostFilter[]).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setFilter(value)}
                className={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${
                  filter === value
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                    : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                }`}
              >
                {value === "all" ? "All" : "Needs comment"}
              </button>
            ))}
          </div>
        </header>
        <div className="flex-1 divide-y divide-zinc-100 overflow-y-auto dark:divide-zinc-800">
          {visible.map((post) => (
            <PostRow
              key={post.id}
              post={post}
              selected={post.id === selected?.id}
              needsComment={needsComment(post)}
              onSelect={() => setSelectedId(post.id)}
            />
          ))}
          {visible.length === 0 && (
            <p className="px-4 py-10 text-center text-sm text-zinc-400">
              Every post has a comment posted. Nothing waiting.
            </p>
          )}
        </div>
      </section>

      <section className="flex-1 overflow-hidden bg-zinc-50 dark:bg-zinc-950">
        {selected ? (
          <PostDetail
            key={selected.id}
            post={selected}
            guidance={commentGuidance}
            onMutate={(fn) => mutateComments(selected.id, fn)}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-zinc-400">
            Select a post.
          </div>
        )}
      </section>
    </div>
  );
}

function PostRow({
  post,
  selected,
  needsComment,
  onSelect,
}: {
  post: FeedPost;
  selected: boolean;
  needsComment: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex w-full flex-col gap-1 border-l-2 px-4 py-3 text-left transition-colors ${
        selected
          ? "border-zinc-900 bg-zinc-100 dark:border-zinc-100 dark:bg-zinc-800"
          : "border-transparent hover:bg-zinc-50 dark:hover:bg-zinc-900"
      }`}
    >
      <span className="flex items-center gap-2">
        <span className="truncate text-sm font-medium">{post.personName}</span>
        <PersonTypeChip type={post.personType} />
        <span className="ml-auto text-[11px] text-zinc-400">{post.postedAt}</span>
      </span>
      <span className="line-clamp-2 text-xs text-zinc-500">{post.content}</span>
      <span className="text-[11px]">
        {needsComment ? (
          <span className="font-medium text-amber-600 dark:text-amber-400">Needs a comment</span>
        ) : (
          <span className="text-emerald-600 dark:text-emerald-400">Comment posted</span>
        )}
      </span>
    </button>
  );
}

function PostDetail({
  post,
  guidance,
  onMutate,
}: {
  post: FeedPost;
  guidance: { tone: string; rules: string[] };
  onMutate: (fn: (comments: FeedComment[]) => FeedComment[]) => void;
}) {
  const [generating, setGenerating] = useState(false);

  const generate = () => {
    setGenerating(true);
    window.setTimeout(() => {
      onMutate((comments) => [
        {
          id: `cmt-${Date.now()}`,
          body: "A fresh AI comment, grounded in this person's info and the comment guidance, would render here - ready for you to edit and post by hand.",
          status: "generated",
          promptVersion: "comment_v2",
          createdAt: "just now",
        },
        ...comments,
      ]);
      setGenerating(false);
    }, 1000);
  };

  const setStatus = (id: string, status: FeedComment["status"]) =>
    onMutate((comments) =>
      comments.map((comment) => (comment.id === id ? { ...comment, status } : comment)),
    );

  const setBody = (id: string, body: string) =>
    onMutate((comments) =>
      comments.map((comment) => (comment.id === id ? { ...comment, body } : comment)),
    );

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-4 border-b border-zinc-200 bg-white px-8 py-5 dark:border-zinc-800 dark:bg-zinc-900">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href={`/prototype/people/${post.personId}`}
              className="text-lg font-semibold tracking-tight underline-offset-2 hover:underline"
            >
              {post.personName}
            </Link>
            <PersonTypeChip type={post.personType} />
          </div>
          <p className="text-sm text-zinc-500">{post.personHeadline}</p>
        </div>
        <a
          href={post.externalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          Open post to comment
        </a>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto px-8 py-6">
        <Section title="The post">
          <p className="text-sm leading-6 text-zinc-700 dark:text-zinc-300">{post.content}</p>
          <p className="mt-2 text-xs text-zinc-400">
            posted {post.postedAt} · fetched {post.fetchedAt}
          </p>
        </Section>

        <Section
          title="Comment drafts"
          right={
            <button
              type="button"
              onClick={generate}
              disabled={generating}
              className="inline-flex items-center gap-1.5 rounded-md border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              {generating ? "Generating..." : "Generate comment"}
              <span className="rounded bg-zinc-100 px-1 font-mono text-[10px] text-zinc-400 dark:bg-zinc-800">
                1 LLM call
              </span>
            </button>
          }
        >
          {post.comments.length === 0 ? (
            <p className="text-sm text-zinc-500">
              No drafts yet. Generate one - it will be grounded in {post.personName.split(" ")[0]}
              &apos;s info and the comment guidance below.
            </p>
          ) : (
            <ul className="space-y-3">
              {post.comments.map((comment) => (
                <CommentCard
                  key={comment.id}
                  comment={comment}
                  onEdit={(body) => setBody(comment.id, body)}
                  onPost={() => setStatus(comment.id, "posted")}
                  onDismiss={() => setStatus(comment.id, "dismissed")}
                />
              ))}
            </ul>
          )}
        </Section>

        <Section title="Comment guidance">
          <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-300">
            <span className="font-medium text-zinc-900 dark:text-zinc-100">Tone:</span>{" "}
            {guidance.tone}
          </p>
          <ul className="mt-2 space-y-1">
            {guidance.rules.map((rule) => (
              <li key={rule} className="flex gap-2 text-xs text-zinc-500">
                <span className="text-zinc-400" aria-hidden>
                  &bull;
                </span>
                {rule}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] italic text-zinc-400">
            Global config every comment is grounded in. Editable in settings (not wired here).
          </p>
        </Section>
      </div>
    </div>
  );
}

function CommentCard({
  comment,
  onEdit,
  onPost,
  onDismiss,
}: {
  comment: FeedComment;
  onEdit: (body: string) => void;
  onPost: () => void;
  onDismiss: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    void navigator.clipboard?.writeText(comment.body);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };
  const editable = comment.status === "generated";

  return (
    <li
      className={`rounded-md border border-zinc-200 p-3 dark:border-zinc-800 ${comment.status === "dismissed" ? "opacity-50" : ""}`}
    >
      <div className="mb-2 flex items-center gap-2">
        <StatusPill status={comment.status} />
        <span className="ml-auto font-mono text-[10px] text-zinc-400">{comment.promptVersion}</span>
      </div>
      {editable ? (
        <textarea
          value={comment.body}
          onChange={(event) => onEdit(event.target.value)}
          rows={3}
          className="w-full resize-y rounded-md border border-zinc-200 bg-white p-2.5 text-sm leading-6 text-zinc-800 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:focus:border-zinc-500"
        />
      ) : (
        <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-300">{comment.body}</p>
      )}
      {editable && (
        <div className="mt-2 flex items-center justify-between">
          <p className="text-xs text-zinc-400">
            Copy it, open the post, and comment yourself (D2).
          </p>
          <div className="flex shrink-0 items-center gap-2">
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
              onClick={onPost}
              className="rounded bg-zinc-900 px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              Mark posted
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    generated: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
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
        <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">{title}</h3>
        {right}
      </div>
      {children}
    </section>
  );
}
