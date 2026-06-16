import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createFakeEnrichment } from "@/lib/enrich/fake";
import { EnrichmentProviderError } from "@/lib/enrich/provider";
import { getEnrichmentProvider } from "@/lib/enrich";

// --- Unit: the provider port + accessor (no DB) ---

describe("enrichment: provider port", () => {
  it("the fake provider returns a bundle tagged 'fake'", async () => {
    const provider = createFakeEnrichment(() => ({ summary: "researched" }));
    const out = await provider.enrich({ kind: "person" } as never);
    expect(out).toEqual({ data: { summary: "researched" }, provider: "fake" });
  });

  it("getEnrichmentProvider defaults to the apify adapter", () => {
    expect(getEnrichmentProvider().name).toBe("apify");
  });

  it("EnrichmentProviderError is tagged", () => {
    expect(new EnrichmentProviderError("x").kind).toBe("enrichment_provider");
  });
});

// --- Integration: the enrich pipeline + dossier-grounded re-draft (fakes, no network) ---

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("enrichment: pipeline (integration)", () => {
  let getDb: typeof import("@/lib/db").getDb;
  let closeDb: typeof import("@/lib/db").closeDb;
  let schema: typeof import("@/lib/db/schema");
  let icp: typeof import("@/lib/icp/config");
  let sources: typeof import("@/lib/signals/sources");
  let scanPipeline: typeof import("@/lib/signals/pipeline");
  let decide: typeof import("@/lib/triage/decide");
  let enrich: typeof import("@/lib/enrich/pipeline");
  let settingsMod: typeof import("@/lib/enrich/settings");

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
    voice: "direct",
    caseStudies: [{ title: "Series B", result: "staged the jump" }],
  };

  const enricher = () =>
    createFakeEnrichment(() => ({ headline: "VP Eng at a Series A", note: "hiring senior staff" }));

  async function truncateAll() {
    const db = getDb();
    await db.delete(schema.dossiers);
    await db.delete(schema.signalDecisions);
    await db.delete(schema.person);
    await db.delete(schema.signals);
    await db.delete(schema.scans);
    await db.delete(schema.sources);
    await db.delete(schema.rubric);
    await db.delete(schema.userProfile);
    await db.delete(schema.settings);
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
    settingsMod = await import("@/lib/enrich/settings");
    await truncateAll();
    await icp.saveRubric({ name: "r", criteria });
    await icp.saveUserProfile(profile);
  });

  afterEach(truncateAll);
  afterAll(async () => {
    await closeDb();
  });

  it("enriches a prospect into one dossier", async () => {
    const personId = await makeProspect();
    const enriched = await enrich.enrichProspect(personId, { provider: enricher() });
    expect(enriched).toMatchObject({ enriched: true });

    const db = getDb();
    const dossierRows = await db
      .select()
      .from(schema.dossiers)
      .where(eq(schema.dossiers.personId, personId));
    expect(dossierRows).toHaveLength(1);
    expect(dossierRows[0].provider).toBe("fake");
  });

  it("re-enriching updates the single dossier (no duplicate)", async () => {
    const personId = await makeProspect();
    await enrich.enrichProspect(personId, { provider: enricher() });
    await enrich.enrichProspect(personId, {
      provider: createFakeEnrichment(() => ({ headline: "updated" })),
    });
    const rows = await getDb()
      .select()
      .from(schema.dossiers)
      .where(eq(schema.dossiers.personId, personId));
    expect(rows).toHaveLength(1);
    expect(rows[0].data).toEqual({ headline: "updated" });
  });

  it("enriching a missing person is a precondition error", async () => {
    await expect(
      enrich.enrichProspect("00000000-0000-0000-0000-000000000000", { provider: enricher() }),
    ).rejects.toThrow(/not found/);
  });

  it("auto-enrich setting defaults off and can be turned on (the routing source)", async () => {
    expect((await settingsMod.getSettings()).autoEnrich).toBe(false);
    await settingsMod.setAutoEnrich(true);
    expect((await settingsMod.getSettings()).autoEnrich).toBe(true);
  });
});
