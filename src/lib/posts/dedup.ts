import type { RawPost } from "@/lib/enrich/provider";

// The dedup key for a fetched post (engagement-posts, ADR-0018): the provider's stable post/activity
// id when present, else a canonicalized permalink (query + fragment stripped, host lowercased,
// trailing slash removed), else null - an item with no stable identifier is dropped, never stored
// (the same anti-fabrication stance the qualifier takes on thin data). This is what makes the
// `(person_id, dedup_key)` upsert idempotent across re-fetches and the activity scan.

export function canonicalizePermalink(url: string): string | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  u.search = "";
  u.hash = "";
  const host = u.host.toLowerCase();
  const path = u.pathname.replace(/\/+$/, "");
  return `${u.protocol.toLowerCase()}//${host}${path}`;
}

export function dedupKeyFor(post: Pick<RawPost, "providerPostId" | "externalUrl">): string | null {
  const id = post.providerPostId?.trim();
  if (id) return id;
  return canonicalizePermalink(post.externalUrl);
}
