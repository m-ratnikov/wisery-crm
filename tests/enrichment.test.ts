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
  let qualify: typeof import("@/lib/qualify/pipeline");
  let enrich: typeof import("@/lib/enrich/pipeline");
  let settingsMod: typeof import("@/lib/enrich/settings");
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
    offer: "1-3 days a week",
    voice: "direct",
    caseStudies: [{ title: "Series B", result: "staged the jump" }],
  };

  const scorer = (score: number) =>
    fakeLLM.createFakeLLM(() => ({ score, reason: "fits", summary: "a prospect" }));
  const enricher = () =>
    createFakeEnrichment(() => ({ headline: "VP Eng at a Series A", note: "hiring senior staff" }));

  async function truncateAll() {
    const db = getDb();
    await db.delete(schema.dossiers);
    await db.delete(schema.scorings);
    await db.delete(schema.person);
    await db.delete(schema.signals);
    await db.delete(schema.scans);
    await db.delete(schema.sources);
    await db.delete(schema.rubric);
    await db.delete(schema.userProfile);
    await db.delete(schema.settings);
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
    settingsMod = await import("@/lib/enrich/settings");
    fakeLLM = await import("@/lib/llm/fake");
    await truncateAll();
    await icp.saveRubric({ name: "r", criteria });
    await icp.saveUserProfile(profile);
  });

  afterEach(truncateAll);
  afterAll(async () => {
    await closeDb();
  });

  it("enriches a qualified prospect into one dossier", async () => {
    const personId = await makeProspect(4);
    const enriched = await enrich.enrichProspect(personId, { provider: enricher() });
    expect(enriched).toMatchObject({ enriched: true, skipped: false });

    const db = getDb();
    const dossierRows = await db
      .select()
      .from(schema.dossiers)
      .where(eq(schema.dossiers.personId, personId));
    expect(dossierRows).toHaveLength(1);
    expect(dossierRows[0].provider).toBe("fake");
  });

  it("re-enriching updates the single dossier (no duplicate)", async () => {
    const personId = await makeProspect(4);
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

  it("does not enrich a below-bar prospect", async () => {
    const personId = await makeProspect(2);
    const outcome = await enrich.enrichProspect(personId, { provider: enricher() });
    expect(outcome.skipped).toBe(true);
    expect(
      await getDb().select().from(schema.dossiers).where(eq(schema.dossiers.personId, personId)),
    ).toHaveLength(0);
  });

  it("auto-enrich setting defaults off and can be turned on (the routing source)", async () => {
    expect((await settingsMod.getSettings()).autoEnrich).toBe(false);
    await settingsMod.setAutoEnrich(true);
    expect((await settingsMod.getSettings()).autoEnrich).toBe(true);
  });
});
