import type { Metadata } from "next";
import Link from "next/link";
import { type FeedPost, listFeed } from "@/lib/posts/read";

// Anchor view #4, wired (engagement-posts, ADR-0018): the Feed of recent posts from `monitored`
// people, newest first. The comment-draft surface on a post detail lands in the comments slice;
// here it is read-and-browse. Server Component.
export const metadata: Metadata = {
  title: "Feed - Wisery CRM",
};

export default async function FeedPage() {
  const posts = await listFeed();

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      <div className="mx-auto w-full max-w-2xl px-8 py-10">
        <header className="mb-6">
          <h1 className="text-lg font-semibold tracking-tight">Feed</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Recent posts from the people you monitor. Flag someone &ldquo;Monitor&rdquo; on their
            card and fetch their latest posts.
          </p>
        </header>

        {posts.length === 0 ? (
          <p className="rounded-lg border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900">
            Nothing yet - monitor a person and fetch their posts.
          </p>
        ) : (
          <ul className="space-y-4">
            {posts.map((post) => (
              <FeedCard key={post.id} post={post} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function FeedCard({ post }: { post: FeedPost }) {
  return (
    <li className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-2 flex items-center justify-between gap-3">
        <Link
          href={`/prospect-list/${post.personId}`}
          className="text-sm font-semibold hover:underline"
        >
          {post.personName ?? "(unknown)"}
        </Link>
        <span className="text-[11px] text-zinc-400">
          {(post.postedAt ?? post.fetchedAt).toLocaleDateString()}
        </span>
      </div>
      <p className="text-sm leading-6 whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">
        {post.content}
      </p>
      <a
        href={post.externalUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 inline-block text-xs font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400"
      >
        Open post &#8599;
      </a>
    </li>
  );
}
