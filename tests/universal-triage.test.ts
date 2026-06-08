import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { rubricKindForSignal } from "@/lib/triage/advisory";

// --- Unit: intent -> rubric kind mapping (no DB) ---

describe("universal-triage: rubric kind for signal", () => {
  it("maps person->icp, content->peer, company->company, and others->icp", () => {
    expect(rubricKindForSignal("person")).toBe("icp");
    expect(rubricKindForSignal("content")).toBe("peer");
    expect(rubricKindForSignal("company")).toBe("company");
    expect(rubricKindForSignal("job")).toBe("icp");
  });
});

// --- Integration: advisory filter + approve/dismiss routing (fakes, no network) ---

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("universal-triage: advisory + decide (integration)", () => {
  let getDb: typeof import("@/lib/db").getDb;
  let closeDb: typeof import("@/lib/db").closeDb;
  let schema: typeof import("@/lib/db/schema");
  let icp: typeof import("@/lib/icp/config");
  let fakeLLM: typeof import("@/lib/llm/fake");
  let advisory: typeof import("@/lib/triage/advisory");
  let decide: typeof import("@/lib/triage/decide");
  let read: typeof import("@/lib/triage/read");

  let sourceId = "";
  let scanId = "";

  const criteria = {
    idealTitles: ["VP Engineering"],
    idealStages: ["Series A"],
    positiveSignals: ["hiring"],
    disqualifiers: ["IC"],
    bands: [{ score: 5, criteria: "exact fit" }],
    insufficientDataRule: "return -1 on thin data",
    platformNote: "platform-aware",
  };

  async function truncateAll() {
    const db = getDb();
    await db.delete(schema.posts);
    await db.delete(schema.scorings);
    await db.delete(schema.signalAdvisory);
    await db.delete(schema.signalDecisions);
    await db.delete(schema.person);
    await db.delete(schema.companies);
    await db.delete(schema.signals);
    await db.delete(schema.scans);
    await db.delete(schema.sources);
    await db.delete(schema.rubric);
    await db.delete(schema.userProfile);
  }

  async function makeSignal(
    kind: "person" | "company" | "content" | "job",
    payload: unknown,
    dedupKey: string,
  ): Promise<string> {
    const [s] = await getDb()
      .insert(schema.signals)
      .values({ sourceId, scanId, kind, dedupKey, payload })
      .returning({ id: schema.signals.id });
    return s.id;
  }

  beforeEach(async () => {
    ({ getDb, closeDb } = await import("@/lib/db"));
    schema = await import("@/lib/db/schema");
    icp = await import("@/lib/icp/config");
    fakeLLM = await import("@/lib/llm/fake");
    advisory = await import("@/lib/triage/advisory");
    decide = await import("@/lib/triage/decide");
    read = await import("@/lib/triage/read");
    await truncateAll();
    await icp.saveRubric({ name: "icp", criteria });
    const [src] = await getDb()
      .insert(schema.sources)
      .values({ kind: "fixture", config: {} })
      .returning({ id: schema.sources.id });
    sourceId = src.id;
    const [scan] = await getDb()
      .insert(schema.scans)
      .values({ sourceId })
      .returning({ id: schema.scans.id });
    scanId = scan.id;
  });
  afterEach(truncateAll);
  afterAll(async () => {
    await closeDb();
  });

  const scorer = (score: number) =>
    fakeLLM.createFakeLLM(() => ({ score, reason: "fits", summary: "a hint" }));

  it("the advisory filter writes a hint and NO durable Scoring", async () => {
    const signalId = await makeSignal("person", { name: "Jane" }, "s1");
    const out = await advisory.runAdvisoryFilter(signalId, { llm: scorer(4) });
    expect(out).toMatchObject({ rubricKind: "icp", scored: true });

    const [hint] = await getDb()
      .select()
      .from(schema.signalAdvisory)
      .where(eq(schema.signalAdvisory.signalId, signalId));
    expect(hint.score).toBe(4);
    // Advisory writes no Scoring row - the learning loop is untouched (ADR-0013/0017).
    expect(await getDb().select().from(schema.scorings)).toHaveLength(0);
  });

  it("a content signal with no peer rubric yields a null advisory (not an error)", async () => {
    const signalId = await makeSignal("content", { url: "https://x/p/1" }, "c1");
    const out = await advisory.runAdvisoryFilter(signalId, { llm: scorer(5) });
    expect(out).toMatchObject({ rubricKind: "peer", scored: false });
    const [hint] = await getDb()
      .select()
      .from(schema.signalAdvisory)
      .where(eq(schema.signalAdvisory.signalId, signalId));
    expect(hint.score).toBeNull();
  });

  it("the triage lane lists only pending signals, with the advisory hint", async () => {
    const a = await makeSignal("person", { name: "Jane" }, "s1");
    await makeSignal("person", { name: "Bob" }, "s2");
    await advisory.runAdvisoryFilter(a, { llm: scorer(4) });

    const before = await read.listTriage();
    expect(before).toHaveLength(2);
    expect(before.find((i) => i.signalId === a)?.advisoryScore).toBe(4);

    await decide.dismissSignal(a);
    const after = await read.listTriage();
    expect(after.map((i) => i.signalId)).not.toContain(a); // dismissed -> gone from the inbox
    expect(after).toHaveLength(1);
  });

  it("approving a person signal creates a prospect Person and enqueues qualify", async () => {
    const signalId = await makeSignal("person", { name: "Jane" }, "s1");
    let enqueuedFor = "";
    const out = await decide.approveSignal(signalId, {
      enqueueQualify: (_tx, personId) => {
        enqueuedFor = personId;
        return Promise.resolve();
      },
    });
    expect(out).toMatchObject({ kind: "person", alreadyDecided: false });
    const [p] = await getDb()
      .select()
      .from(schema.person)
      .where(eq(schema.person.signalId, signalId));
    expect(p).toMatchObject({ type: "prospect", origin: "signal", status: "new" });
    expect(enqueuedFor).toBe(p.id);
    expect(out.createdEntityId).toBe(p.id);
  });

  it("approving a company signal creates a Company", async () => {
    const signalId = await makeSignal("company", { name: "Acme" }, "co1");
    const out = await decide.approveSignal(signalId);
    expect(out.kind).toBe("company");
    const [c] = await getDb()
      .select()
      .from(schema.companies)
      .where(eq(schema.companies.signalId, signalId));
    expect(c.name).toBe("Acme");
    expect(out.createdEntityId).toBe(c.id);
  });

  it("approving a content signal creates a peer Person with the post attached", async () => {
    const signalId = await makeSignal(
      "content",
      { name: "Pat", url: "https://li.com/p/9", content: "great post" },
      "ct1",
    );
    const out = await decide.approveSignal(signalId);
    expect(out.kind).toBe("content");
    const [peer] = await getDb()
      .select()
      .from(schema.person)
      .where(eq(schema.person.signalId, signalId));
    expect(peer.type).toBe("peer");
    const peerPosts = await getDb()
      .select()
      .from(schema.posts)
      .where(eq(schema.posts.personId, peer.id));
    expect(peerPosts).toHaveLength(1);
    expect(peerPosts[0].content).toBe("great post");
  });

  it("re-approving the same signal is idempotent (no second entity)", async () => {
    const signalId = await makeSignal("company", { name: "Acme" }, "co1");
    await decide.approveSignal(signalId);
    const second = await decide.approveSignal(signalId);
    expect(second.alreadyDecided).toBe(true);
    expect(await getDb().select().from(schema.companies)).toHaveLength(1);
  });

  it("a missing signal id is a precondition error", async () => {
    const bogus = "00000000-0000-0000-0000-000000000000";
    await expect(decide.approveSignal(bogus)).rejects.toThrow(/not found/);
    await expect(advisory.runAdvisoryFilter(bogus, { llm: scorer(4) })).rejects.toThrow(
      /not found/,
    );
  });
});
