import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { rubricCriteriaSchema, userProfileSchema } from "@/lib/icp/schema";

// --- Unit: the config-as-data Zod schemas (no DB) ---

const validCriteria = {
  idealTitles: ["VP Engineering"],
  idealStages: ["Series A"],
  positiveSignals: ["hiring push"],
  disqualifiers: ["IC with no authority"],
  bands: [{ score: 5, criteria: "exact fit" }],
  insufficientDataRule: "return -1 on thin data",
  platformNote: "platform-aware",
};

const validProfile = {
  positioning: "Fractional CTO",
  offer: "1-3 days a week",
  voice: "direct, peer-to-peer",
  caseStudies: [{ title: "Series B", result: "staged the jump" }],
};

describe("icp-config: rubric/profile schemas", () => {
  it("accepts a well-formed rubric and profile", () => {
    expect(rubricCriteriaSchema.safeParse(validCriteria).success).toBe(true);
    expect(userProfileSchema.safeParse(validProfile).success).toBe(true);
  });

  it("rejects a band score outside 1-5", () => {
    const bad = { ...validCriteria, bands: [{ score: 9, criteria: "x" }] };
    expect(rubricCriteriaSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects a profile missing positioning", () => {
    const rest = {
      offer: validProfile.offer,
      voice: validProfile.voice,
      caseStudies: validProfile.caseStudies,
    };
    expect(userProfileSchema.safeParse(rest).success).toBe(false);
  });
});

// --- Integration: config-as-data layer against real Postgres ---

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("icp-config: config-as-data layer (integration)", () => {
  let getDb: typeof import("@/lib/db").getDb;
  let closeDb: typeof import("@/lib/db").closeDb;
  let schema: typeof import("@/lib/db/schema");
  let cfg: typeof import("@/lib/icp/config");
  let seed: typeof import("@/lib/icp/seed");

  async function truncateAll() {
    const db = getDb();
    await db.delete(schema.rubric);
    await db.delete(schema.userProfile);
  }

  beforeEach(async () => {
    ({ getDb, closeDb } = await import("@/lib/db"));
    schema = await import("@/lib/db/schema");
    cfg = await import("@/lib/icp/config");
    seed = await import("@/lib/icp/seed");
    await truncateAll();
  });

  afterEach(truncateAll);
  afterAll(async () => {
    await closeDb();
  });

  it("seeds an active rubric and a profile, and re-seeding is a no-op", async () => {
    await seed.seedIcpConfig();
    const active = await cfg.getActiveRubric();
    expect(active).not.toBeNull();
    expect(active?.name).toMatch(/Fractional CTO/);
    expect(await cfg.getUserProfile()).not.toBeNull();

    await seed.seedIcpConfig(); // idempotent
    const rows = await getDb().select().from(schema.rubric);
    const profiles = await getDb().select().from(schema.userProfile);
    expect(rows).toHaveLength(1);
    expect(profiles).toHaveLength(1);
  });

  it("saves rubrics additively: two versions, only the latest active, prior retained", async () => {
    const first = await cfg.saveRubric({ name: "v1 rubric", criteria: validCriteria });
    const second = await cfg.saveRubric({
      name: "v2 rubric",
      criteria: { ...validCriteria, idealTitles: ["Head of Engineering"] },
    });

    expect(second.version).toBe(first.version + 1);

    const active = await cfg.getActiveRubric();
    expect(active?.name).toBe("v2 rubric");

    const rows = await getDb().select().from(schema.rubric);
    expect(rows).toHaveLength(2);
    expect(rows.filter((r) => r.active)).toHaveLength(1);
    // the prior version row is retained unchanged
    const prior = rows.find((r) => r.id === first.id);
    expect(prior?.active).toBe(false);
    expect(prior?.name).toBe("v1 rubric");
  });

  it("saves profiles additively and returns the latest", async () => {
    await cfg.saveUserProfile(validProfile);
    const second = await cfg.saveUserProfile({ ...validProfile, voice: "warmer" });
    const latest = await cfg.getUserProfile();
    expect(latest?.version).toBe(second.version);
    expect(latest?.profile.voice).toBe("warmer");
    expect(await getDb().select().from(schema.userProfile)).toHaveLength(2);
  });

  it("the partial unique index forbids two active rubrics", async () => {
    await cfg.saveRubric({ name: "only-active", criteria: validCriteria });
    // Bypass the safe write path to prove the DB guard holds.
    await expect(
      getDb()
        .insert(schema.rubric)
        .values({ name: "second-active", rubric: validCriteria, version: 99, active: true }),
    ).rejects.toThrow();
  });
});
