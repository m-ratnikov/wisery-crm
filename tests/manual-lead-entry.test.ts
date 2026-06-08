import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { personSubject } from "@/lib/prospect/identity";
import { manualLeadSchema } from "@/lib/prospect/manual";
import { displayName } from "@/lib/prospect/read";

// --- Unit: the PersonSubject seam, the display-name resolver, and the manual-lead schema (no DB) ---

describe("manual-lead-entry: PersonSubject seam", () => {
  it("builds a subject from a manual prospect's own columns", () => {
    const subject = personSubject(
      {
        id: "p1",
        origin: "manual",
        name: "Alice",
        headline: "VP Eng",
        company: "Acme",
        linkedinUrl: null,
      } as never,
      null,
    );
    expect(subject.kind).toBe("person");
    expect(subject.payload).toMatchObject({ name: "Alice", headline: "VP Eng", company: "Acme" });
  });

  it("builds a subject from the signal for a discovered prospect", () => {
    const subject = personSubject(
      { id: "p2", origin: "signal", name: null } as never,
      { kind: "person", payload: { name: "Bob" } } as never,
    );
    expect(subject).toEqual({ kind: "person", payload: { name: "Bob" } });
  });

  it("throws when a signal-origin prospect has no signal", () => {
    expect(() => personSubject({ id: "p3", origin: "signal" } as never, null)).toThrow(
      /missing its signal/,
    );
  });
});

describe("manual-lead-entry: displayName", () => {
  it("uses the manual prospect's own name", () => {
    expect(
      displayName({ origin: "manual", manualName: "Alice", payload: null, signalKind: null }),
    ).toBe("Alice");
  });

  it("falls back for a nameless manual prospect", () => {
    expect(
      displayName({ origin: "manual", manualName: null, payload: null, signalKind: null }),
    ).toBe("(unnamed lead)");
  });

  it("reads the payload name for a discovered prospect", () => {
    expect(
      displayName({
        origin: "signal",
        manualName: null,
        payload: { name: "Bob" },
        signalKind: "person",
      }),
    ).toBe("Bob");
  });
});

describe("manual-lead-entry: manualLeadSchema", () => {
  it("requires a name", () => {
    expect(manualLeadSchema.safeParse({ name: "" }).success).toBe(false);
    expect(manualLeadSchema.safeParse({}).success).toBe(false);
  });

  it("accepts a name with optional identity fields", () => {
    const parsed = manualLeadSchema.parse({ name: "  Alice  ", company: "Acme" });
    expect(parsed.name).toBe("Alice");
    expect(parsed.company).toBe("Acme");
  });
});

// --- Integration: manual add + prospect-keyed qualify + the origin CHECK, against real Postgres ---

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("manual-lead-entry: pipeline (integration)", () => {
  let getDb: typeof import("@/lib/db").getDb;
  let closeDb: typeof import("@/lib/db").closeDb;
  let schema: typeof import("@/lib/db/schema");
  let icp: typeof import("@/lib/icp/config");
  let manual: typeof import("@/lib/prospect/manual");
  let qualify: typeof import("@/lib/qualify/pipeline");
  let read: typeof import("@/lib/prospect/read");
  let signalsPipeline: typeof import("@/lib/signals/pipeline");
  let sources: typeof import("@/lib/signals/sources");
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
    fake.createFakeLLM(() => ({ score, reason: "fits", summary: "a prospect" }));

  async function truncateAll() {
    const db = getDb();
    await db.delete(schema.scorings);
    await db.delete(schema.person);
    await db.delete(schema.signals);
    await db.delete(schema.scans);
    await db.delete(schema.sources);
    await db.delete(schema.rubric);
  }

  beforeEach(async () => {
    ({ getDb, closeDb } = await import("@/lib/db"));
    schema = await import("@/lib/db/schema");
    icp = await import("@/lib/icp/config");
    manual = await import("@/lib/prospect/manual");
    qualify = await import("@/lib/qualify/pipeline");
    read = await import("@/lib/prospect/read");
    signalsPipeline = await import("@/lib/signals/pipeline");
    sources = await import("@/lib/signals/sources");
    fake = await import("@/lib/llm/fake");
    await truncateAll();
    await icp.saveRubric({ name: "test rubric", criteria });
  });

  afterEach(truncateAll);
  afterAll(async () => {
    await closeDb();
  });

  it("a manual lead starts unscored (no auto-score) and re-score writes an llm Scoring", async () => {
    const id = await manual.addManualLead({ name: "Alice", company: "Acme" });
    const db = getDb();
    const [p] = await db.select().from(schema.person).where(eq(schema.person.id, id));
    expect(p.origin).toBe("manual");
    expect(p.signalId).toBeNull();
    expect(p.name).toBe("Alice");
    expect(p.status).toBe("new");
    // Manual entry no longer auto-scores (ADR-0019): no Scoring exists until the user re-scores.
    expect(
      await db.select().from(schema.scorings).where(eq(schema.scorings.personId, id)),
    ).toHaveLength(0);

    const result = await qualify.qualifyProspect(id, { llm: scorer(4) });
    expect(result.qualifiedProspectIds).toEqual([id]);
    const [p2] = await db.select().from(schema.person).where(eq(schema.person.id, id));
    expect(p2.status).toBe("qualified");
    const ss = await db.select().from(schema.scorings).where(eq(schema.scorings.personId, id));
    expect(ss).toHaveLength(1);
    expect(ss[0].score).toBe(4);
    expect(ss[0].provenance).toBe("llm");
  });

  it("re-score is additive, newest-row-wins (no scored-already guard, ADR-0019)", async () => {
    const id = await manual.addManualLead({ name: "Bob" });
    await qualify.qualifyProspect(id, { llm: scorer(4) });
    const again = await qualify.qualifyProspect(id, { llm: scorer(5) });
    expect(again.skipped).toBe(false);
    // Both Scorings coexist (additive); the read elsewhere takes the latest by scored_at.
    const ss = await getDb().select().from(schema.scorings).where(eq(schema.scorings.personId, id));
    expect(ss).toHaveLength(2);
    expect(ss.every((s) => s.provenance === "llm")).toBe(true);
  });

  it("the origin CHECK forbids a signal-origin row with no signal and a manual row with no name", async () => {
    const db = getDb();
    await expect(
      db.insert(schema.person).values({ origin: "signal", status: "new" }),
    ).rejects.toThrow();
    await expect(
      db.insert(schema.person).values({ origin: "manual", status: "new" }),
    ).rejects.toThrow();
  });

  it("lists a manual prospect alongside a discovered one, the discovered one unchanged", async () => {
    // Manual prospect - a distinct name so it does not collide with the fixture's "Alice".
    await manual.addManualLead({ name: "Mona Manual" });
    // Discovered prospect via the fixture connector + signal-keyed qualify.
    const source = await sources.createSource({ kind: "fixture", config: {} });
    const scan = await signalsPipeline.runScan(source.id);
    await qualify.qualifySignal(scan.persistedSignalIds[0], { llm: scorer(4) });

    const items = await read.listProspects();
    const mona = items.find((i) => i.name === "Mona Manual");
    expect(mona?.origin).toBe("manual");
    expect(mona?.sourceKind).toBe("manual");
    // The discovered prospect appears with its signal-derived identity and a real source kind.
    const discovered = items.find((i) => i.origin === "signal");
    expect(discovered).toBeDefined();
    expect(discovered?.sourceKind).toBe("fixture");
  });
});
