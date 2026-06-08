import { asc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { pipeline, pipelineStatus } from "@/lib/db/schema";

// Test helper: the default pipeline's entry (position-0) status, the pipeline + status_id every
// newly created Person takes (ADR-0020). The pipeline + statuses are seeded by migration 0016 and
// are not truncated by the suites, so this resolves them for direct person inserts in tests.
export async function entryStatus(): Promise<{ pipelineId: string; statusId: string }> {
  const db = getDb();
  const [p] = await db
    .select({ id: pipeline.id })
    .from(pipeline)
    .where(eq(pipeline.slug, "linkedin-outreach"))
    .limit(1);
  const [s] = await db
    .select({ id: pipelineStatus.id })
    .from(pipelineStatus)
    .where(eq(pipelineStatus.pipelineId, p.id))
    .orderBy(asc(pipelineStatus.position))
    .limit(1);
  return { pipelineId: p.id, statusId: s.id };
}
