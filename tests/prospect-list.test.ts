import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";

// The prospect-list read-model against real Postgres. Gated on TEST_DATABASE_URL.
const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("prospect-list: read-model (integration)", () => {
  let getDb: typeof import("@/lib/db").getDb;
  let closeDb: typeof import("@/lib/db").closeDb;
  let schema: typeof import("@/lib/db/schema");
  let icp: typeof import("@/lib/icp/config");
  let sources: typeof import("@/lib/signals/sources");
  let scanPipeline: typeof import("@/lib/signals/pipeline");
  let qualify: typeof import("@/lib/qualify/pipeline");
  let enrich: typeof import("@/lib/enrich/pipeline");
  let read: typeof import("@/lib/prospect/read");
  let fakeLLM: typeof import("@/lib/llm/fake");
  let fakeEnrich: typeof import("@/lib/enrich/fake");

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
    fakeLLM.createFakeLLM(() => ({ score: s, reason: "fits the bar", summary: "a VP Eng" }));
  const enricher = () => fakeEnrich.createFakeEnrichment(() => ({ headline: "VP Eng, Series A" }));

  async function truncateAll() {
    const db = getDb();
    for (const t of [
      schema.dossiers,
      schema.scorings,
      schema.person,
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

  async function makeProspect(score: number): Promise<string> {
    const source = await sources.createSource({ kind: "fixture", config: {} });
    const scan = await scanPipeline.runScan(source.id);
    await qualify.qualifySignal(scan.persistedSignalIds[0], { llm: scorer(score) });
    const [p] = await getDb()
      .select()
      .from(schema.person)
      .where(eq(schema.person.signalId, scan.persistedSignalIds[0]));
    return p.id;
  }

  beforeEach(async () => {
    ({ getDb, closeDb } = await import("@/lib/db"));
    schema = await import("@/lib/db/schema");
    icp = await import("@/lib/icp/config");
    sources = await import("@/lib/signals/sources");
    scanPipeline = await import("@/lib/signals/pipeline");
    qualify = await import("@/lib/qualify/pipeline");
    enrich = await import("@/lib/enrich/pipeline");
    read = await import("@/lib/prospect/read");
    fakeLLM = await import("@/lib/llm/fake");
    fakeEnrich = await import("@/lib/enrich/fake");
    await truncateAll();
    await icp.saveRubric({ name: "r", criteria });
    await icp.saveUserProfile(profile);
  });

  afterEach(truncateAll);
  afterAll(async () => {
    await closeDb();
  });

  it("lists a qualified+enriched prospect with the derived enriched facet, and a bare one without", async () => {
    const full = await makeProspect(4);
    await enrich.enrichProspect(full, { provider: enricher() });

    const bare = await makeProspect(4); // qualified, not enriched

    const items = await read.listProspects();
    const byId = new Map(items.map((i) => [i.id, i]));

    const fullItem = byId.get(full);
    expect(fullItem?.score).toBe(4);
    expect(fullItem?.sourceKind).toBe("fixture");
    expect(fullItem?.enriched).toBe(true);
    // status is the pipeline position ('Cold', the entry status) now, distinct from qualification,
    // which is the derived read over the score (ADR-0019/0020).
    expect(fullItem?.status).toBe("Cold");
    expect(fullItem?.qualification).toBe("qualified");

    const bareItem = byId.get(bare);
    expect(bareItem?.enriched).toBe(false);
    expect(bareItem?.status).toBe("Cold");
    expect(bareItem?.qualification).toBe("qualified");
  });

  it("returns a prospect's detail with its latest scoring and dossier", async () => {
    const personId = await makeProspect(5);
    await enrich.enrichProspect(personId, { provider: enricher() });

    const detail = await read.getProspectDetail(personId);
    expect(detail?.score).toBe(5);
    expect(detail?.reason).toMatch(/bar/i);
    expect(detail?.dossier).toEqual({ headline: "VP Eng, Series A" });
    expect(detail?.status).toBe("Cold");
    expect(detail?.qualification).toBe("qualified");
  });

  it("returns null detail for an unknown prospect", async () => {
    expect(await read.getProspectDetail("00000000-0000-0000-0000-000000000000")).toBeNull();
  });
});
