import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";

// The prospect-list read-model against real Postgres. Gated on TEST_DATABASE_URL.
const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("prospect-list: read-model (integration)", () => {
  let getDb: typeof import("@/lib/db").getDb;
  let closeDb: typeof import("@/lib/db").closeDb;
  let schema: typeof import("@/lib/db/schema");
  let icp: typeof import("@/lib/icp/config");
  let sources: typeof import("@/lib/signals/sources");
  let scanPipeline: typeof import("@/lib/signals/pipeline");
  let decide: typeof import("@/lib/triage/decide");
  let enrich: typeof import("@/lib/enrich/pipeline");
  let read: typeof import("@/lib/prospect/read");
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
  const enricher = () => fakeEnrich.createFakeEnrichment(() => ({ headline: "VP Eng, Series A" }));

  async function truncateAll() {
    const db = getDb();
    for (const t of [
      schema.dossiers,
      schema.signalDecisions,
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

  // A prospect is born by human approval at triage (ADR-0022): scan, then approve the signal.
  async function makeProspect(): Promise<string> {
    const source = await sources.createSource({ kind: "fixture", config: {} });
    const scan = await scanPipeline.runScan(source.id);
    const out = await decide.approveSignal(scan.persistedSignalIds[0]);
    if (!out.createdEntityId) throw new Error("approval created no person");
    return out.createdEntityId;
  }

  beforeEach(async () => {
    ({ getDb, closeDb } = await import("@/lib/db"));
    schema = await import("@/lib/db/schema");
    icp = await import("@/lib/icp/config");
    sources = await import("@/lib/signals/sources");
    scanPipeline = await import("@/lib/signals/pipeline");
    decide = await import("@/lib/triage/decide");
    enrich = await import("@/lib/enrich/pipeline");
    read = await import("@/lib/prospect/read");
    fakeEnrich = await import("@/lib/enrich/fake");
    await truncateAll();
    await icp.saveRubric({ name: "r", criteria });
    await icp.saveUserProfile(profile);
  });

  afterEach(truncateAll);
  afterAll(async () => {
    await closeDb();
  });

  it("lists an enriched prospect with the derived enriched facet, and a bare one without", async () => {
    const full = await makeProspect();
    await enrich.enrichProspect(full, { provider: enricher() });

    const bare = await makeProspect(); // approved, not enriched

    const items = await read.listProspects();
    const byId = new Map(items.map((i) => [i.id, i]));

    const fullItem = byId.get(full);
    expect(fullItem?.sourceKind).toBe("fixture");
    expect(fullItem?.enriched).toBe(true);
    // status is the pipeline position ('Cold', the entry status); no score or qualification
    // appears on the read-model (ADR-0022).
    expect(fullItem?.status).toBe("Cold");

    const bareItem = byId.get(bare);
    expect(bareItem?.enriched).toBe(false);
    expect(bareItem?.status).toBe("Cold");
  });

  it("returns a prospect's detail with its dossier", async () => {
    const personId = await makeProspect();
    await enrich.enrichProspect(personId, { provider: enricher() });

    const detail = await read.getProspectDetail(personId);
    expect(detail?.dossier).toEqual({ headline: "VP Eng, Series A" });
    expect(detail?.status).toBe("Cold");
  });

  it("returns null detail for an unknown prospect", async () => {
    expect(await read.getProspectDetail("00000000-0000-0000-0000-000000000000")).toBeNull();
  });
});
