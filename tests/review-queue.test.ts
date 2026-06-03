import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("review-queue: read-model + transitions (integration)", () => {
  let getDb: typeof import("@/lib/db").getDb;
  let closeDb: typeof import("@/lib/db").closeDb;
  let schema: typeof import("@/lib/db/schema");
  let icp: typeof import("@/lib/icp/config");
  let sources: typeof import("@/lib/signals/sources");
  let scanPipeline: typeof import("@/lib/signals/pipeline");
  let qualify: typeof import("@/lib/qualify/pipeline");
  let draft: typeof import("@/lib/draft/pipeline");
  let queueRead: typeof import("@/lib/queue/read");
  let transitions: typeof import("@/lib/queue/transitions");
  let fakeLLM: typeof import("@/lib/llm/fake");

  const criteria = {
    idealTitles: ["VP Engineering"],
    idealStages: ["Series A"],
    positiveSignals: ["hiring push"],
    disqualifiers: ["IC"],
    bands: [{ score: 5, criteria: "exact fit" }],
    insufficientDataRule: "return -1 on thin data",
    platformNote: "platform-aware",
  };
  const profile = {
    positioning: "Fractional CTO",
    offer: "1-3 days",
    voice: "direct",
    caseStudies: [{ title: "B", result: "staged" }],
  };
  const scorer = (s: number) =>
    fakeLLM.createFakeLLM(() => ({ score: s, reason: "fits", summary: "p" }));
  const drafter = () => fakeLLM.createFakeLLM(() => ({ body: "Saw your hiring push." }));

  async function truncateAll() {
    const db = getDb();
    for (const t of [
      schema.outcomes,
      schema.drafts,
      schema.dossiers,
      schema.scorings,
      schema.prospects,
      schema.signals,
      schema.scans,
      schema.sources,
      schema.rubric,
      schema.userProfile,
      schema.settings,
    ]) {
      await db.delete(t);
    }
  }

  // qualify (score) -> draft -> queued. Returns the prospect id.
  async function makeQueued(score = 4): Promise<string> {
    const source = await sources.createSource({ kind: "fixture", config: {} });
    const scan = await scanPipeline.runScan(source.id);
    await qualify.qualifySignal(scan.persistedSignalIds[0], { llm: scorer(score) });
    const [p] = await getDb()
      .select()
      .from(schema.prospects)
      .where(eq(schema.prospects.signalId, scan.persistedSignalIds[0]));
    if (score >= 3) await draft.draftProspect(p.id, { llm: drafter() });
    return p.id;
  }

  beforeEach(async () => {
    ({ getDb, closeDb } = await import("@/lib/db"));
    schema = await import("@/lib/db/schema");
    icp = await import("@/lib/icp/config");
    sources = await import("@/lib/signals/sources");
    scanPipeline = await import("@/lib/signals/pipeline");
    qualify = await import("@/lib/qualify/pipeline");
    draft = await import("@/lib/draft/pipeline");
    queueRead = await import("@/lib/queue/read");
    transitions = await import("@/lib/queue/transitions");
    fakeLLM = await import("@/lib/llm/fake");
    await truncateAll();
    await icp.saveRubric({ name: "r", criteria });
    await icp.saveUserProfile(profile);
  });

  afterEach(truncateAll);
  afterAll(async () => {
    await closeDb();
  });

  it("lists queued prospects with their draft and score; excludes non-queued", async () => {
    const queued = await makeQueued(4);
    const belowBar = await makeQueued(2); // not drafted, stays below_bar

    const items = await queueRead.listQueue();
    expect(items.map((i) => i.id)).toContain(queued);
    expect(items.map((i) => i.id)).not.toContain(belowBar);
    const item = items.find((i) => i.id === queued);
    expect(item?.score).toBe(4);
    expect(item?.draft).toMatch(/hiring push/i);
  });

  it("acts and dismisses only from queued (no-op otherwise)", async () => {
    const a = await makeQueued(4);
    expect((await transitions.actProspect(a)).changed).toBe(true);
    const [pa] = await getDb().select().from(schema.prospects).where(eq(schema.prospects.id, a));
    expect(pa.status).toBe("acted");
    // acting again is a no-op (no longer queued)
    expect((await transitions.actProspect(a)).changed).toBe(false);

    const d = await makeQueued(4);
    expect((await transitions.dismissProspect(d)).changed).toBe(true);
    const [pd] = await getDb().select().from(schema.prospects).where(eq(schema.prospects.id, d));
    expect(pd.status).toBe("dismissed");
  });

  it("logs an outcome against the score + draft and closes the prospect", async () => {
    const id = await makeQueued(4);
    // can't log an outcome before acting
    expect((await transitions.logOutcome(id, { result: "replied" })).changed).toBe(false);

    await transitions.actProspect(id);
    const res = await transitions.logOutcome(id, { result: "booked", notes: "call set" });
    expect(res.changed).toBe(true);

    const db = getDb();
    const [outcome] = await db
      .select()
      .from(schema.outcomes)
      .where(eq(schema.outcomes.prospectId, id));
    expect(outcome.result).toBe("booked");
    expect(outcome.scoreAtTime).toBe(4);
    expect(outcome.draftId).not.toBeNull();
    expect(outcome.notes).toBe("call set");

    const [p] = await db.select().from(schema.prospects).where(eq(schema.prospects.id, id));
    expect(p.status).toBe("closed");
  });

  it("is idempotent under a double-submit: one Outcome, second log a no-op", async () => {
    const id = await makeQueued(4);
    await transitions.actProspect(id);

    // Two concurrent submits race the atomic acted -> closed claim.
    const [first, second] = await Promise.all([
      transitions.logOutcome(id, { result: "booked" }),
      transitions.logOutcome(id, { result: "replied" }),
    ]);
    expect([first.changed, second.changed].filter(Boolean)).toHaveLength(1);

    const rows = await getDb()
      .select()
      .from(schema.outcomes)
      .where(eq(schema.outcomes.prospectId, id));
    expect(rows).toHaveLength(1);
  });
});
