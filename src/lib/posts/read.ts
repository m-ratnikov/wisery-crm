import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { person, posts, signals } from "@/lib/db/schema";

// Read-models for the engagement Feed and the person-detail posts list (engagement-posts).
// The display name resolves through the same origin branch as the pipeline: a manual person's
// `name` column, else the signal payload's `name` (the signal-origin path) - one COALESCE rather
// than an N+1 over the PersonSubject seam.
export interface FeedPost {
  id: string;
  personId: string;
  personName: string | null;
  externalUrl: string;
  content: string;
  postedAt: Date | null;
  fetchedAt: Date;
}

const personNameExpr = sql<string | null>`coalesce(${person.name}, ${signals.payload}->>'name')`;
// Newest first: a real post date when known, else when we fetched it; nulls never float to the top.
const newestFirst = sql`coalesce(${posts.postedAt}, ${posts.fetchedAt}) desc`;

// One representation of the posts select + person/signal joins, shared by both reads below.
function postsQuery() {
  return getDb()
    .select({
      id: posts.id,
      personId: posts.personId,
      personName: personNameExpr,
      externalUrl: posts.externalUrl,
      content: posts.content,
      postedAt: posts.postedAt,
      fetchedAt: posts.fetchedAt,
    })
    .from(posts)
    .innerJoin(person, eq(posts.personId, person.id))
    .leftJoin(signals, eq(person.signalId, signals.id));
}

// The Feed: recent posts from `monitored` people, newest first, optionally filtered to one person.
export async function listFeed(opts: { personId?: string } = {}): Promise<FeedPost[]> {
  const where = opts.personId
    ? and(eq(person.monitored, true), eq(person.id, opts.personId))
    : eq(person.monitored, true);
  return postsQuery().where(where).orderBy(newestFirst);
}

// A single person's posts (the person detail), newest first - works whether or not they are monitored.
export async function listPostsForPerson(personId: string): Promise<FeedPost[]> {
  return postsQuery().where(eq(posts.personId, personId)).orderBy(newestFirst);
}
