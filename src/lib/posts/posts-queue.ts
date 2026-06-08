import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { person } from "@/lib/db/schema";
import { enqueue, getBoss, work } from "@/lib/jobs";
import { logger } from "@/lib/log";
import { fetchAndStorePosts } from "@/lib/posts/pipeline";

// Engagement post fetching as pg-boss handlers (engagement-posts, ADR-0018). User-triggered ("get
// latest posts") and the scheduled activity scan share one fetch-posts handler; the activity scan
// is a fan-out dispatcher (one job per monitored person, per-unit isolation D-K), not a monolith.
const FETCH_POSTS_QUEUE = "fetch-posts";
const ACTIVITY_SCAN_QUEUE = "activity-scan";

// User-triggered, fire-and-forget (the person-card "get latest posts" action). A failed enqueue
// surfaces to the user, who clicks again (ADR-0009 carve-out); singleton-keyed per person.
export async function enqueueFetchPosts(personId: string): Promise<string | null> {
  return enqueue(FETCH_POSTS_QUEUE, { personId }, { singletonKey: personId });
}

export async function registerFetchPostsWorker(): Promise<void> {
  await getBoss().createQueue(FETCH_POSTS_QUEUE, { policy: "singleton" });
  await work<{ personId: string }>(FETCH_POSTS_QUEUE, async (jobs) => {
    for (const job of jobs) {
      await fetchAndStorePosts(job.data.personId);
    }
  });
}

// The activity scan: a cron-scheduled DISPATCHER that enqueues one fetch-posts job per monitored
// person, so one person's provider failure dead-letters alone (per-unit isolation, D-K), never the
// whole scan. The default cadence is hourly; the composition root passes the cron.
export async function registerActivityScan(cron = "0 * * * *"): Promise<void> {
  await getBoss().createQueue(ACTIVITY_SCAN_QUEUE);
  await work(ACTIVITY_SCAN_QUEUE, async () => {
    const monitored = await getDb()
      .select({ id: person.id })
      .from(person)
      .where(eq(person.monitored, true));
    for (const p of monitored) {
      try {
        await enqueueFetchPosts(p.id);
      } catch (err) {
        logger.error({ err, personId: p.id }, "failed to enqueue activity-scan fetch-posts");
      }
    }
  });
  await getBoss().schedule(ACTIVITY_SCAN_QUEUE, cron);
}
