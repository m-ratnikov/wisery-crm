import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { rawItemSchema } from "@/lib/signals/connector";
import { getConnector } from "@/lib/signals/registry";

// --- Unit: the edge-validation schema and the registry (no DB) ---

describe("signal-ingestion: RawItem edge validation", () => {
  it("accepts a normalized item", () => {
    const r = rawItemSchema.safeParse({ kind: "person", dedupKey: "x:1", payload: { a: 1 } });
    expect(r.success).toBe(true);
  });

  it("rejects a blank dedup key", () => {
    expect(rawItemSchema.safeParse({ kind: "person", dedupKey: "", payload: {} }).success).toBe(
      false,
    );
  });

  it("rejects a missing dedup key", () => {
    expect(rawItemSchema.safeParse({ kind: "person", payload: {} }).success).toBe(false);
  });

  it("rejects a kind outside the closed set", () => {
    expect(rawItemSchema.safeParse({ kind: "robot", dedupKey: "x:1", payload: {} }).success).toBe(
      false,
    );
  });
});

describe("signal-ingestion: connector registry", () => {
  it("resolves the registered fixture connector", () => {
    expect(getConnector("fixture").kind).toBe("fixture");
  });

  it("throws for an unregistered source kind", () => {
    expect(() => getConnector("does-not-exist")).toThrow(/no connector registered/);
  });
});

// --- Integration: the full scan loop against real Postgres (isolated by cleanup) ---
// Gated on TEST_DATABASE_URL, like the backbone db/jobs tests; skips cleanly without it.

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("signal-ingestion: scan pipeline (integration)", () => {
  // Imported lazily so the server-only db module is only pulled in when the suite runs.
  let getDb: typeof import("@/lib/db").getDb;
  let closeDb: typeof import("@/lib/db").closeDb;
  let runScan: typeof import("@/lib/signals/pipeline").runScan;
  let schema: typeof import("@/lib/db/schema");

  // FK-safe truncate (RESTRICT forbids parent-first) so each test starts and ends clean.
  async function truncateAll() {
    const db = getDb();
    await db.delete(schema.signals);
    await db.delete(schema.scans);
    await db.delete(schema.sources);
  }

  beforeEach(async () => {
    ({ getDb, closeDb } = await import("@/lib/db"));
    ({ runScan } = await import("@/lib/signals/pipeline"));
    schema = await import("@/lib/db/schema");
    await truncateAll();
  });

  afterEach(truncateAll);

  afterAll(async () => {
    await closeDb();
  });

  async function createSource(config: Record<string, unknown> = {}): Promise<string> {
    const db = getDb();
    const [row] = await db
      .insert(schema.sources)
      .values({ kind: "fixture", config })
      .returning({ id: schema.sources.id });
    return row.id;
  }

  it("records a completed scan with counts, and every signal traces to its origin", async () => {
    const sourceId = await createSource();
    const result = await runScan(sourceId);

    // Default fixture: 4 fetched, 2 persisted (alice, bob), 2 dropped (1 dedup, 1 invalid).
    expect(result.status).toBe("completed");
    expect(result).toMatchObject({ fetched: 4, persisted: 2, dropped: 2 });

    const db = getDb();
    const rows = await db
      .select()
      .from(schema.signals)
      .where(eq(schema.signals.sourceId, sourceId));
    expect(rows).toHaveLength(2);
    for (const sig of rows) {
      expect(sig.sourceId).toBe(sourceId);
      expect(sig.scanId).toBe(result.scanId);
    }

    const [scan] = await db.select().from(schema.scans).where(eq(schema.scans.id, result.scanId));
    expect(scan.status).toBe("completed");
    expect(scan.finishedAt).not.toBeNull();
    expect(scan.fetchedCount).toBe(4);
    expect(scan.persistedCount).toBe(2);
    expect(scan.droppedCount).toBe(2);
  });

  it("is idempotent across re-scans and leaves persisted signals unchanged", async () => {
    const sourceId = await createSource();
    await runScan(sourceId);
    const second = await runScan(sourceId);

    expect(second.persisted).toBe(0);
    expect(second.dropped).toBe(4);

    const db = getDb();
    const rows = await db
      .select()
      .from(schema.signals)
      .where(eq(schema.signals.sourceId, sourceId));
    expect(rows).toHaveLength(2);

    const [alice] = await db
      .select()
      .from(schema.signals)
      .where(
        and(eq(schema.signals.sourceId, sourceId), eq(schema.signals.dedupKey, "fixture:alice")),
      );
    // First occurrence won; the later duplicate never overwrote it.
    expect(alice.payload).toEqual({ name: "Alice", headline: "VP Eng" });
  });

  it("treats the same dedup key under a different source as a distinct signal", async () => {
    const a = await createSource();
    const b = await createSource();
    await runScan(a);
    await runScan(b);

    const db = getDb();
    const aliceRows = await db
      .select()
      .from(schema.signals)
      .where(eq(schema.signals.dedupKey, "fixture:alice"));
    expect(aliceRows).toHaveLength(2);
    expect(new Set(aliceRows.map((r) => r.sourceId))).toEqual(new Set([a, b]));
  });

  it("isolates a failing source: its scan fails while a sibling completes", async () => {
    const bad = await createSource({ throwAfter: 1 });
    const good = await createSource();

    const badResult = await runScan(bad);
    const goodResult = await runScan(good);

    expect(badResult.status).toBe("failed");
    expect(badResult.error).toMatch(/simulated connector failure/);
    expect(goodResult.status).toBe("completed");
    expect(goodResult.persisted).toBe(2);

    const db = getDb();
    const [badScan] = await db
      .select()
      .from(schema.scans)
      .where(eq(schema.scans.id, badResult.scanId));
    expect(badScan.status).toBe("failed");
    expect(badScan.error).toMatch(/simulated connector failure/);
  });

  it("preserves scan and signal history when a source is retired (disabled)", async () => {
    const sourceId = await createSource();
    await runScan(sourceId);

    const db = getDb();
    await db.update(schema.sources).set({ enabled: false }).where(eq(schema.sources.id, sourceId));

    const [source] = await db.select().from(schema.sources).where(eq(schema.sources.id, sourceId));
    expect(source.enabled).toBe(false);

    const signalsAfter = await db
      .select()
      .from(schema.signals)
      .where(eq(schema.signals.sourceId, sourceId));
    const scansAfter = await db
      .select()
      .from(schema.scans)
      .where(eq(schema.scans.sourceId, sourceId));
    expect(signalsAfter).toHaveLength(2);
    expect(scansAfter).toHaveLength(1);
  });

  it("drops an item missing its payload without failing the whole scan", async () => {
    // A payload-less item is malformed (rawItemSchema requires payload); it must be
    // dropped at the edge, leaving the scan completed - not throw and fail the run.
    const sourceId = await createSource({
      items: [
        { kind: "person", dedupKey: "fixture:with-payload", payload: { ok: true } },
        { kind: "person", dedupKey: "fixture:no-payload" },
      ],
    });
    const result = await runScan(sourceId);
    expect(result.status).toBe("completed");
    expect(result).toMatchObject({ fetched: 2, persisted: 1, dropped: 1 });
  });

  it("throws for a source id that does not exist", async () => {
    await expect(runScan("00000000-0000-0000-0000-000000000000")).rejects.toThrow(/not found/);
  });
});
