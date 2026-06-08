import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { person, posts, signals } from "@/lib/db/schema";
import { getEnrichmentProvider } from "@/lib/enrich";
import type { EnrichmentProvider } from "@/lib/enrich/provider";
import { dedupKeyFor } from "@/lib/posts/dedup";
import { personSubject } from "@/lib/prospect/identity";
import { loadProspectById } from "@/lib/prospect/load";

// The testable posts core (engagement-posts, ADR-0018): fetch a person's recent posts via the
// EnrichmentProvider port and idempotently upsert them on `(person_id, dedup_key)`. Works for ANY
// person (a monitored prospect or a peer), not just an actionable one - so it does not reuse
// loadActionableProspect's status gate. The provider is injectable so tests use the fake. db-only.
export interface FetchPostsOutcome {
  personId: string;
  fetched: number;
  stored: number;
  dropped: number;
}

export async function fetchAndStorePosts(
  personId: string,
  opts: { provider?: EnrichmentProvider } = {},
): Promise<FetchPostsOutcome> {
  const db = getDb();
  const personRow = await loadProspectById(personId);
  const [signal] = personRow.signalId
    ? await db.select().from(signals).where(eq(signals.id, personRow.signalId)).limit(1)
    : [null];
  const subject = personSubject(personRow, signal ?? null);

  const provider = opts.provider ?? getEnrichmentProvider();
  const raw = await provider.fetchPosts(subject);

  let stored = 0;
  let dropped = 0;
  for (const rp of raw) {
    const dedupKey = dedupKeyFor(rp);
    // No stable identifier -> drop rather than store (anti-fabrication, consistent with UC4).
    if (!dedupKey) {
      dropped += 1;
      continue;
    }
    await db
      .insert(posts)
      .values({
        personId,
        externalUrl: rp.externalUrl,
        dedupKey,
        content: rp.content,
        postedAt: rp.postedAt ?? null,
        fetchedAt: new Date(),
      })
      // Idempotent on (person_id, dedup_key): a re-fetch or the activity scan refreshes the row,
      // never duplicates it.
      .onConflictDoUpdate({
        target: [posts.personId, posts.dedupKey],
        set: {
          externalUrl: rp.externalUrl,
          content: rp.content,
          postedAt: rp.postedAt ?? null,
          fetchedAt: new Date(),
        },
      });
    stored += 1;
  }

  return { personId, fetched: raw.length, stored, dropped };
}

// Set / clear the `monitored` flag on a person (engagement-posts): the people whose posts the Feed
// watches. Independent of `type` (ADR-0015).
export async function setMonitored(personId: string, monitored: boolean): Promise<void> {
  await getDb().update(person).set({ monitored }).where(eq(person.id, personId));
}
