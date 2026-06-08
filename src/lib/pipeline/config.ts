import "server-only";
import { asc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { person, pipeline, pipelineStatus } from "@/lib/db/schema";

// Configurable pipelines (ADR-0020), config-as-data read/write - a peer of the icp-config rubric
// reads. A Person's pipeline position is a FK into pipeline_status, resolved here; the default
// pipeline ("linkedin-outreach") is the one newly created People enter, at its position-0 status.

// The default pipeline's stable slug; the seed and backfill key on it (ADR-0020).
const DEFAULT_PIPELINE_SLUG = "linkedin-outreach";

export interface PipelineStatusOption {
  id: string;
  name: string;
  position: number;
}

export interface DefaultPipeline {
  id: string;
  statuses: PipelineStatusOption[];
}

export async function getDefaultPipeline(): Promise<DefaultPipeline> {
  const db = getDb();
  const [p] = await db
    .select({ id: pipeline.id })
    .from(pipeline)
    .where(eq(pipeline.slug, DEFAULT_PIPELINE_SLUG))
    .limit(1);
  // The default pipeline is seeded by migration 0016; its absence is a precondition failure, not a
  // user-recoverable state, so throw rather than silently return an empty pipeline.
  if (!p) {
    throw new Error(`default pipeline "${DEFAULT_PIPELINE_SLUG}" not found (seed missing)`);
  }
  const statuses = await db
    .select({ id: pipelineStatus.id, name: pipelineStatus.name, position: pipelineStatus.position })
    .from(pipelineStatus)
    .where(eq(pipelineStatus.pipelineId, p.id))
    .orderBy(asc(pipelineStatus.position));
  return { id: p.id, statuses };
}

// The entry status (position 0) of the default pipeline - the column every newly created Person
// takes (ADR-0020). Returns the pipeline id alongside so a caller can set both FK columns in one
// insert without a second query.
export async function getEntryStatus(): Promise<{ pipelineId: string; statusId: string }> {
  const { id, statuses } = await getDefaultPipeline();
  const entry = statuses[0];
  if (!entry) {
    throw new Error(`default pipeline "${DEFAULT_PIPELINE_SLUG}" has no statuses (seed missing)`);
  }
  return { pipelineId: id, statusId: entry.id };
}

export async function getEntryStatusId(): Promise<string> {
  return (await getEntryStatus()).statusId;
}

// Move a Person to a status. The composite FK (pipeline_id, status_id) -> pipeline_status guarantees
// the status belongs to the Person's own pipeline, so a status_id from another pipeline is rejected
// by the database (ADR-0020), not by an app-layer check - this bare update throws on a bad pair.
export async function setPersonStatus(personId: string, statusId: string): Promise<void> {
  await getDb().update(person).set({ statusId }).where(eq(person.id, personId));
}
