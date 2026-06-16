import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { entryStatus } from "./helpers/entry-status";

// Configurable pipelines (ADR-0020), against real Postgres. The default pipeline + its 10 statuses
// are seeded by migration 0016 and are NOT truncated here; this suite asserts the seed and the
// status-setter (incl the composite-FK cross-pipeline guard).

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("pipeline: seed + status-setter (integration)", () => {
  let getDb: typeof import("@/lib/db").getDb;
  let closeDb: typeof import("@/lib/db").closeDb;
  let schema: typeof import("@/lib/db/schema");
  let pipelineCfg: typeof import("@/lib/pipeline/config");

  async function truncatePeople() {
    // Only people - never the seeded pipeline rows.
    const db = getDb();
    await db.delete(schema.person);
  }

  beforeEach(async () => {
    ({ getDb, closeDb } = await import("@/lib/db"));
    schema = await import("@/lib/db/schema");
    pipelineCfg = await import("@/lib/pipeline/config");
    await truncatePeople();
  });
  afterEach(truncatePeople);
  afterAll(async () => {
    await closeDb();
  });

  it("seeds the default pipeline with its 10 ordered statuses, Cold first", async () => {
    const pipeline = await pipelineCfg.getDefaultPipeline();
    expect(pipeline.statuses).toHaveLength(10);
    expect(pipeline.statuses.map((s) => s.name)).toEqual([
      "Cold",
      "CR Sent",
      "CR Accepted",
      "FU Sent",
      "Conversation",
      "Discovery call",
      "Not Interested",
      "Ghosted",
      "Proposal Sent",
      "On Hold",
    ]);
    // Positions are 0..9 in order.
    expect(pipeline.statuses.map((s) => s.position)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);

    const entry = await pipelineCfg.getEntryStatus();
    expect(entry.statusId).toBe(pipeline.statuses[0].id);
    expect(await pipelineCfg.getEntryStatusId()).toBe(pipeline.statuses[0].id);
  });

  it("setPersonStatus moves a person to another status in its own pipeline", async () => {
    const entry = await entryStatus();
    const [p] = await getDb()
      .insert(schema.person)
      .values({ origin: "manual", name: "Mover", ...entry })
      .returning({ id: schema.person.id });

    const pipeline = await pipelineCfg.getDefaultPipeline();
    const target = pipeline.statuses.find((s) => s.name === "CR Sent")!;
    await pipelineCfg.setPersonStatus(p.id, target.id);

    const [after] = await getDb()
      .select({ statusId: schema.person.statusId })
      .from(schema.person)
      .where(eq(schema.person.id, p.id));
    expect(after.statusId).toBe(target.id);
  });

  it("rejects a status that belongs to another pipeline (the composite FK guard)", async () => {
    const entry = await entryStatus();
    const [p] = await getDb()
      .insert(schema.person)
      .values({ origin: "manual", name: "Guarded", ...entry })
      .returning({ id: schema.person.id });

    // A second pipeline with its own status; pointing the person at it (while pipeline_id stays the
    // default) violates the composite FK (pipeline_id, status_id) -> pipeline_status(pipeline_id, id).
    const [other] = await getDb()
      .insert(schema.pipeline)
      .values({ name: "Other", slug: `other-${Date.now()}` })
      .returning({ id: schema.pipeline.id });
    const [otherStatus] = await getDb()
      .insert(schema.pipelineStatus)
      .values({ pipelineId: other.id, name: "Alien", position: 0 })
      .returning({ id: schema.pipelineStatus.id });

    await expect(pipelineCfg.setPersonStatus(p.id, otherStatus.id)).rejects.toThrow();

    // Cleanup the extra pipeline (people truncation does not reach it).
    await getDb().delete(schema.pipelineStatus).where(eq(schema.pipelineStatus.id, otherStatus.id));
    await getDb().delete(schema.pipeline).where(eq(schema.pipeline.id, other.id));
  });
});
