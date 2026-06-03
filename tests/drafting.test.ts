import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { draftResultSchema } from "@/lib/draft/drafter";

// --- Unit: the draft-result schema (no DB) ---

describe("drafting: draft-result schema", () => {
  it("accepts a non-empty body and rejects an empty or missing one", () => {
    expect(draftResultSchema.safeParse({ body: "Hi, saw your post" }).success).toBe(true);
    expect(draftResultSchema.safeParse({ body: "" }).success).toBe(false);
    expect(draftResultSchema.safeParse({}).success).toBe(false);
  });
});

// --- Integration: the draft pipeline against real Postgres, with the fake LLM ---

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("drafting: draft pipeline (integration)", () => {
  let getDb: typeof import("@/lib/db").getDb;
  let closeDb: typeof import("@/lib/db").closeDb;
  let schema: typeof import("@/lib/db/schema");
  let icp: typeof import("@/lib/icp/config");
  let sources: typeof import("@/lib/signals/sources");
  let scanPipeline: typeof import("@/lib/signals/pipeline");
  let qualify: typeof import("@/lib/qualify/pipeline");
  let draft: typeof import("@/lib/draft/pipeline");
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
  const profile = {
    positioning: "Fractional CTO",
    offer: "1-3 days a week",
    voice: "direct, peer-to-peer",
    caseStudies: [{ title: "Series B", result: "staged the jump" }],
  };

  const scorer = (score: number) =>
    fake.createFakeLLM(() => ({ score, reason: "fits", summary: "a prospect" }));
  const drafter = () =>
    fake.createFakeLLM(() => ({ body: "Saw your hiring push - happy to share what worked." }));

  async function truncateAll() {
    const db = getDb();
    await db.delete(schema.drafts);
    await db.delete(schema.scorings);
    await db.delete(schema.prospects);
    await db.delete(schema.signals);
    await db.delete(schema.scans);
    await db.delete(schema.sources);
    await db.delete(schema.rubric);
    await db.delete(schema.userProfile);
  }

  // Qualify a fixture signal at the given score; return the prospect id (qualified or not).
  async function makeProspect(score: number): Promise<string> {
    const source = await sources.createSource({ kind: "fixture", config: {} });
    const scan = await scanPipeline.runScan(source.id);
    await qualify.qualifySignal(scan.persistedSignalIds[0], { llm: scorer(score) });
    const [p] = await getDb()
      .select()
      .from(schema.prospects)
      .where(eq(schema.prospects.signalId, scan.persistedSignalIds[0]));
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
    fake = await import("@/lib/llm/fake");
    await truncateAll();
    await icp.saveRubric({ name: "r", criteria });
    await icp.saveUserProfile(profile);
  });

  afterEach(truncateAll);
  afterAll(async () => {
    await closeDb();
  });

  it("drafts a qualified prospect, persists a selected draft, and queues it", async () => {
    const prospectId = await makeProspect(4);
    const outcome = await draft.draftProspect(prospectId, { llm: drafter() });
    expect(outcome).toMatchObject({ drafted: true, skipped: false });

    const db = getDb();
    const rows = await db
      .select()
      .from(schema.drafts)
      .where(eq(schema.drafts.prospectId, prospectId));
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("selected");
    expect(rows[0].body).toMatch(/hiring push/i);
    expect(rows[0].provider).toBe("fake");
    expect(rows[0].promptVersion).toBe("v1");
    expect(rows[0].model).toBe("claude-opus-4-8");

    const [p] = await db.select().from(schema.prospects).where(eq(schema.prospects.id, prospectId));
    expect(p.status).toBe("queued");
  });

  it("does not draft a below-bar prospect", async () => {
    const prospectId = await makeProspect(2);
    const outcome = await draft.draftProspect(prospectId, { llm: drafter() });
    expect(outcome.skipped).toBe(true);
    expect(
      await getDb().select().from(schema.drafts).where(eq(schema.drafts.prospectId, prospectId)),
    ).toHaveLength(0);
  });

  it("is idempotent: a second auto-draft creates no second selected draft", async () => {
    const prospectId = await makeProspect(4);
    await draft.draftProspect(prospectId, { llm: drafter() });
    const again = await draft.draftProspect(prospectId, { llm: drafter() });
    expect(again.skipped).toBe(true);
    expect(
      await getDb().select().from(schema.drafts).where(eq(schema.drafts.prospectId, prospectId)),
    ).toHaveLength(1);
  });

  it("forced re-draft selects the new draft and archives the prior", async () => {
    const prospectId = await makeProspect(4);
    await draft.draftProspect(prospectId, { llm: drafter() });
    const redraft = await draft.draftProspect(prospectId, { llm: drafter(), force: true });
    expect(redraft.drafted).toBe(true);

    const db = getDb();
    const all = await db
      .select()
      .from(schema.drafts)
      .where(eq(schema.drafts.prospectId, prospectId));
    expect(all).toHaveLength(2);
    const selected = all.filter((d) => d.status === "selected");
    const archived = all.filter((d) => d.status === "archived");
    expect(selected).toHaveLength(1);
    expect(archived).toHaveLength(1);
    // still queued
    const [p] = await db.select().from(schema.prospects).where(eq(schema.prospects.id, prospectId));
    expect(p.status).toBe("queued");
  });
});
