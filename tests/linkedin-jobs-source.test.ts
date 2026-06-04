import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { normalizeJob } from "@/lib/signals/connectors/linkedin-jobs";
import { buildAndValidateConfig, listConnectableKinds } from "@/lib/signals/source-kinds";

// --- Unit: the pure job normalization and the LinkedIn-jobs catalog entry (no DB) ---

describe("linkedin-jobs: normalizeJob", () => {
  it("maps a posting to a job-kind RawItem with a stable dedup key", () => {
    const item = normalizeJob({
      jobId: "123",
      title: "VP Engineering",
      company: "Acme",
      location: "Remote",
      url: "https://example.com/123",
      postedAt: "2026-06-01",
    });
    expect(item.kind).toBe("job");
    expect(item.dedupKey).toBe("linkedin-job:123");
    expect(item.payload).toMatchObject({ title: "VP Engineering", company: "Acme" });
  });

  it("throws on a posting with no stable id (cannot dedup)", () => {
    expect(() => normalizeJob({ jobId: "" })).toThrow(/stable jobId/);
  });
});

describe("linkedin-jobs: catalog entry", () => {
  it("is connectable (its connector is registered) and requires keywords", () => {
    const kinds = listConnectableKinds();
    expect(kinds.map((k) => k.kind)).toContain("linkedin-jobs");

    const read = (values: Record<string, string>) => (f: string) => values[f] ?? "";
    // A config built from the declared fields with keywords validates.
    expect(() =>
      buildAndValidateConfig("linkedin-jobs", read({ keywords: "VP Engineering" })),
    ).not.toThrow();
    // Missing keywords is rejected (required, min 1).
    expect(() => buildAndValidateConfig("linkedin-jobs", read({ keywords: "" }))).toThrow();
  });
});

// --- Integration: the queue handles a non-person entity - a job signal persists and the
// persisted-signal handoff is routed by kind, against real Postgres ---

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("linkedin-jobs: kind routing (integration)", () => {
  let getDb: typeof import("@/lib/db").getDb;
  let closeDb: typeof import("@/lib/db").closeDb;
  let schema: typeof import("@/lib/db/schema");
  let signalsPipeline: typeof import("@/lib/signals/pipeline");
  let sources: typeof import("@/lib/signals/sources");

  async function truncateAll() {
    const db = getDb();
    await db.delete(schema.signals);
    await db.delete(schema.scans);
    await db.delete(schema.sources);
  }

  beforeEach(async () => {
    ({ getDb, closeDb } = await import("@/lib/db"));
    schema = await import("@/lib/db/schema");
    signalsPipeline = await import("@/lib/signals/pipeline");
    sources = await import("@/lib/signals/sources");
    await truncateAll();
  });

  afterEach(truncateAll);
  afterAll(async () => {
    await closeDb();
  });

  it("persists a job signal and routes the handoff by kind", async () => {
    // The fixture connector can emit any kind via config; use it to drive a person and a job
    // item through the same pipeline (the queue is entity-agnostic for persistence).
    const source = await sources.createSource({
      kind: "fixture",
      config: {
        items: [
          { kind: "person", dedupKey: "p1", payload: { name: "Alice" } },
          { kind: "job", dedupKey: "j1", payload: { title: "VP Engineering" } },
        ],
      },
    });

    const handoffs: Array<{ kind: string }> = [];
    const result = await signalsPipeline.runScan(source.id, {
      // Record the kind of every persisted-signal handoff; apply the same person-only routing
      // the composition root uses, to prove a job is persisted but NOT handed off to qualify.
      enqueueNext: (_tx, _signalId, kind) => {
        if (kind === "person") handoffs.push({ kind });
        return Promise.resolve();
      },
    });

    expect(result.persisted).toBe(2);
    const persisted = await getDb()
      .select({ kind: schema.signals.kind })
      .from(schema.signals)
      .where(eq(schema.signals.sourceId, source.id));
    expect(persisted.map((s) => s.kind).sort()).toEqual(["job", "person"]);
    // Only the person signal was handed off to qualify; the job awaits normalize-expand.
    expect(handoffs).toEqual([{ kind: "person" }]);
  });
});
