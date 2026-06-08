import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { entryStatus } from "./helpers/entry-status";

// Configurable pipelines (ADR-0020) + the qualification read (ADR-0019), against real Postgres.
// The default pipeline + its 10 statuses are seeded by migration 0016 and are NOT truncated here;
// these suites assert the seed, the status-setter (incl the composite-FK cross-pipeline guard), and
// the derived qualification read over the latest icp Scoring.

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("pipeline: seed + status-setter (integration)", () => {
  let getDb: typeof import("@/lib/db").getDb;
  let closeDb: typeof import("@/lib/db").closeDb;
  let schema: typeof import("@/lib/db/schema");
  let pipelineCfg: typeof import("@/lib/pipeline/config");

  async function truncatePeople() {
    // Only people (and their scorings) - never the seeded pipeline rows.
    const db = getDb();
    await db.delete(schema.scorings);
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

describe.skipIf(!url)("pipeline: qualification read (integration)", () => {
  let getDb: typeof import("@/lib/db").getDb;
  let closeDb: typeof import("@/lib/db").closeDb;
  let schema: typeof import("@/lib/db/schema");
  let icp: typeof import("@/lib/icp/config");
  let qualifyRead: typeof import("@/lib/qualify/read");

  const criteria = {
    idealTitles: ["VP Engineering"],
    idealStages: ["Series A"],
    positiveSignals: ["hiring"],
    disqualifiers: ["IC"],
    bands: [{ score: 5, criteria: "exact fit" }],
    insufficientDataRule: "return -1 on thin data",
    platformNote: "platform-aware",
  };

  async function truncate() {
    const db = getDb();
    await db.delete(schema.scorings);
    await db.delete(schema.person);
    await db.delete(schema.rubric);
  }

  async function makePerson(): Promise<string> {
    const entry = await entryStatus();
    const [p] = await getDb()
      .insert(schema.person)
      .values({ origin: "manual", name: "Q", ...entry })
      .returning({ id: schema.person.id });
    return p.id;
  }

  // Insert an icp Scoring against the active icp rubric. `scoredAt` is settable so the "latest wins"
  // ordering is deterministic (defaultNow can collide for back-to-back inserts).
  async function score(personId: string, value: number, scoredAt?: Date): Promise<void> {
    const rubric = await icp.getActiveRubric("icp");
    await getDb()
      .insert(schema.scorings)
      .values({
        personId,
        rubricId: rubric!.id,
        score: value,
        provenance: "llm",
        provider: "fake",
        promptVersion: "v1",
        model: "m",
        ...(scoredAt ? { scoredAt } : {}),
      });
  }

  beforeEach(async () => {
    ({ getDb, closeDb } = await import("@/lib/db"));
    schema = await import("@/lib/db/schema");
    icp = await import("@/lib/icp/config");
    qualifyRead = await import("@/lib/qualify/read");
    await truncate();
    await icp.saveRubric({ name: "icp", criteria });
  });
  afterEach(truncate);
  afterAll(async () => {
    await closeDb();
  });

  it("reads unassessed with no icp Scoring", async () => {
    const id = await makePerson();
    expect(await qualifyRead.qualificationFor(id)).toBe("unassessed");
  });

  it("reads qualified for a latest icp score >= 3 and below_bar under it", async () => {
    const hi = await makePerson();
    await score(hi, 4);
    expect(await qualifyRead.qualificationFor(hi)).toBe("qualified");

    const lo = await makePerson();
    await score(lo, 2);
    expect(await qualifyRead.qualificationFor(lo)).toBe("below_bar");

    const thin = await makePerson();
    await score(thin, -1);
    expect(await qualifyRead.qualificationFor(thin)).toBe("below_bar");
  });

  it("takes the LATEST icp Scoring and ignores non-icp Scorings", async () => {
    // A peer-rubric scoring must not count toward qualification (icp only). saveRubric is icp-scoped,
    // so insert the peer rubric directly.
    const [peerRubric] = await getDb()
      .insert(schema.rubric)
      .values({ name: "peer", kind: "peer", rubric: criteria, version: 1, active: true })
      .returning({ id: schema.rubric.id });
    const id = await makePerson();
    await getDb().insert(schema.scorings).values({
      personId: id,
      rubricId: peerRubric.id,
      score: 5,
      provenance: "llm",
      provider: "fake",
      promptVersion: "v1",
      model: "m",
    });
    expect(await qualifyRead.qualificationFor(id)).toBe("unassessed");

    // An older icp scoring is superseded by a newer one (scored_at desc).
    await score(id, 2, new Date("2026-01-01T00:00:00Z"));
    await score(id, 4, new Date("2026-02-01T00:00:00Z"));
    expect(await qualifyRead.qualificationFor(id)).toBe("qualified");
  });

  it("the batch read returns each person's qualification in one query", async () => {
    const hi = await makePerson();
    await score(hi, 5);
    const lo = await makePerson();
    await score(lo, 1);
    const none = await makePerson();

    const map = await qualifyRead.qualificationForMany([hi, lo, none]);
    expect(map.get(hi)).toBe("qualified");
    expect(map.get(lo)).toBe("below_bar");
    expect(map.get(none)).toBe("unassessed");
    // The empty-input fast path returns an empty map.
    expect((await qualifyRead.qualificationForMany([])).size).toBe(0);
  });
});
