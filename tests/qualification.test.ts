import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { gateStatus } from "@/lib/qualify/status";
import { scoreResultSchema } from "@/lib/qualify/scorer";

// --- Unit: the gate and the score-result schema (no DB) ---

describe("qualification: gate + score schema", () => {
  it("gates >= 3 to qualified, below 3 and -1 to below_bar", () => {
    expect(gateStatus(5)).toBe("qualified");
    expect(gateStatus(3)).toBe("qualified");
    expect(gateStatus(2)).toBe("below_bar");
    expect(gateStatus(1)).toBe("below_bar");
    expect(gateStatus(-1)).toBe("below_bar");
  });

  it("accepts -1 and 1-5 but rejects 0 and out-of-range scores", () => {
    for (const score of [-1, 1, 5]) {
      expect(scoreResultSchema.safeParse({ score, reason: "r", summary: "s" }).success).toBe(true);
    }
    for (const score of [0, 6, -2, 3.5]) {
      expect(scoreResultSchema.safeParse({ score, reason: "r", summary: "s" }).success).toBe(false);
    }
  });
});

// --- Integration: the qualify pipeline against real Postgres, with the fake LLM ---

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("qualification: qualify pipeline (integration)", () => {
  let getDb: typeof import("@/lib/db").getDb;
  let closeDb: typeof import("@/lib/db").closeDb;
  let schema: typeof import("@/lib/db/schema");
  let icp: typeof import("@/lib/icp/config");
  let signalsPipeline: typeof import("@/lib/signals/pipeline");
  let sources: typeof import("@/lib/signals/sources");
  let qualify: typeof import("@/lib/qualify/pipeline");
  let fake: typeof import("@/lib/llm/fake");

  const criteria = {
    idealTitles: ["VP Engineering"],
    idealStages: ["Series A"],
    positiveSignals: ["hiring push"],
    disqualifiers: ["IC"],
    bands: [{ score: 5, criteria: "exact fit" }],
    insufficientDataRule: "return -1 on thin data",
    platformNote: "platform-aware",
  };

  const scorer = (score: number) =>
    fake.createFakeLLM(() => ({ score, reason: "fits the rubric", summary: "a prospect" }));

  async function truncateAll() {
    const db = getDb();
    await db.delete(schema.scorings);
    await db.delete(schema.prospects);
    await db.delete(schema.signals);
    await db.delete(schema.scans);
    await db.delete(schema.sources);
    await db.delete(schema.rubric);
    await db.delete(schema.userProfile);
  }

  // Persist a fixture signal and return its id (the fixture's first persisted signal).
  async function persistOneSignal(): Promise<string> {
    const source = await sources.createSource({ kind: "fixture", config: {} });
    const result = await signalsPipeline.runScan(source.id);
    return result.persistedSignalIds[0];
  }

  beforeEach(async () => {
    ({ getDb, closeDb } = await import("@/lib/db"));
    schema = await import("@/lib/db/schema");
    icp = await import("@/lib/icp/config");
    signalsPipeline = await import("@/lib/signals/pipeline");
    sources = await import("@/lib/signals/sources");
    qualify = await import("@/lib/qualify/pipeline");
    fake = await import("@/lib/llm/fake");
    await truncateAll();
    await icp.saveRubric({ name: "test rubric", criteria });
  });

  afterEach(truncateAll);
  afterAll(async () => {
    await closeDb();
  });

  it("fans a person signal out to one prospect with one scoring carrying its versions", async () => {
    const signalId = await persistOneSignal();
    const result = await qualify.qualifySignal(signalId, { llm: scorer(4) });
    expect(result).toMatchObject({ prospectsCreated: 1, skipped: false });

    const db = getDb();
    const ps = await db
      .select()
      .from(schema.prospects)
      .where(eq(schema.prospects.signalId, signalId));
    expect(ps).toHaveLength(1);

    const ss = await db
      .select()
      .from(schema.scorings)
      .where(eq(schema.scorings.prospectId, ps[0].id));
    expect(ss).toHaveLength(1);
    expect(ss[0].score).toBe(4);
    expect(ss[0].provider).toBe("fake");
    expect(ss[0].promptVersion).toBe("v1");
    expect(ss[0].model).toBe("claude-haiku-4-5-20251001");
    const active = await icp.getActiveRubric();
    expect(ss[0].rubricId).toBe(active?.id);
  });

  it("gates a 4 to qualified and a 2 and -1 to below_bar", async () => {
    const db = getDb();

    const qualified = await persistOneSignal();
    await qualify.qualifySignal(qualified, { llm: scorer(4) });
    const [p4] = await db
      .select()
      .from(schema.prospects)
      .where(eq(schema.prospects.signalId, qualified));
    expect(p4.status).toBe("qualified");

    // A different scan/source yields a distinct signal to score below the bar.
    await truncateAll();
    await icp.saveRubric({ name: "test rubric", criteria });
    const low = await persistOneSignal();
    await qualify.qualifySignal(low, { llm: scorer(2) });
    const [p2] = await db.select().from(schema.prospects).where(eq(schema.prospects.signalId, low));
    expect(p2.status).toBe("below_bar");

    await truncateAll();
    await icp.saveRubric({ name: "test rubric", criteria });
    const thin = await persistOneSignal();
    await qualify.qualifySignal(thin, { llm: scorer(-1) });
    const [pNeg] = await db
      .select()
      .from(schema.prospects)
      .where(eq(schema.prospects.signalId, thin));
    expect(pNeg.status).toBe("below_bar");
  });

  it("is idempotent: re-qualifying the same signal creates no second prospect", async () => {
    const signalId = await persistOneSignal();
    await qualify.qualifySignal(signalId, { llm: scorer(4) });
    const again = await qualify.qualifySignal(signalId, { llm: scorer(5) });
    expect(again.skipped).toBe(true);
    expect(again.prospectsCreated).toBe(0);
    const ps = await getDb()
      .select()
      .from(schema.prospects)
      .where(eq(schema.prospects.signalId, signalId));
    expect(ps).toHaveLength(1);
    // Exactly one scoring too - the duplicate run incurs no second scoring (no double spend).
    const ss = await getDb()
      .select()
      .from(schema.scorings)
      .where(eq(schema.scorings.prospectId, ps[0].id));
    expect(ss).toHaveLength(1);
  });

  it("hard-errors when no active rubric exists", async () => {
    const signalId = await persistOneSignal();
    await getDb().delete(schema.scorings);
    await getDb().delete(schema.rubric);
    await expect(qualify.qualifySignal(signalId, { llm: scorer(4) })).rejects.toThrow(
      /no active ICP rubric/,
    );
  });

  it("runScan reports only newly persisted signal ids; a re-scan reports none", async () => {
    const source = await sources.createSource({ kind: "fixture", config: {} });
    const first = await signalsPipeline.runScan(source.id);
    expect(first.persistedSignalIds.length).toBe(first.persisted);
    expect(first.persisted).toBeGreaterThan(0);

    const second = await signalsPipeline.runScan(source.id);
    expect(second.persistedSignalIds).toHaveLength(0);
  });
});
