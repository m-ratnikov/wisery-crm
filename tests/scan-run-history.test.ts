import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  assembleScanHistory,
  mapScanRun,
  scanHistoryUnavailable,
  sourceLabel,
  summarize,
  type ScanRunRow,
} from "@/lib/signals/scan-history-map";

// --- Unit: the pure scan-run-history mapper (no DB) ---
// The Drizzle I/O lives in scan-history.ts (integration-tested below); this is the testable
// raw -> DTO half (plain-language summary, source label, ISO conversion).

const row = (over: Partial<ScanRunRow>): ScanRunRow => ({
  id: "scan-1",
  status: "completed",
  startedAt: new Date("2026-06-04T10:00:00.000Z"),
  finishedAt: new Date("2026-06-04T10:00:01.000Z"),
  fetchedCount: 0,
  persistedCount: 0,
  droppedCount: 0,
  error: null,
  sourceKind: "fixture",
  sourceConfig: { name: "LinkedIn search" },
  ...over,
});

describe("scan-run-history: sourceLabel", () => {
  it("uses the source's config name when present", () => {
    expect(sourceLabel("linkedin-jobs", { name: "Series A eng hiring" })).toBe(
      "Series A eng hiring",
    );
  });

  it("falls back to the kind when name is missing, blank, or not a string", () => {
    expect(sourceLabel("fixture", {})).toBe("fixture");
    expect(sourceLabel("fixture", { name: "   " })).toBe("fixture");
    expect(sourceLabel("fixture", { name: 42 })).toBe("fixture");
    expect(sourceLabel("fixture", null)).toBe("fixture");
  });
});

describe("scan-run-history: summarize (design D4 branches)", () => {
  it("a completed scan that persisted new signals reports fetched + new", () => {
    expect(summarize("completed", { fetched: 12, persisted: 5, dropped: 0 }, null)).toBe(
      "fetched 12, 5 new",
    );
  });

  it("a completed scan with new signals and duplicates reports the already-seen count", () => {
    expect(summarize("completed", { fetched: 12, persisted: 2, dropped: 10 }, null)).toBe(
      "fetched 12, 2 new, 10 already seen",
    );
  });

  it("a completed scan that found only duplicates says all already seen", () => {
    expect(summarize("completed", { fetched: 12, persisted: 0, dropped: 12 }, null)).toBe(
      "fetched 12, no new signals, all already seen",
    );
  });

  it("a completed scan that fetched nothing says nothing matched", () => {
    expect(summarize("completed", { fetched: 0, persisted: 0, dropped: 0 }, null)).toBe(
      "nothing matched",
    );
  });

  it("a failed scan reports its error, or a generic fallback when none was recorded", () => {
    expect(summarize("failed", { fetched: 0, persisted: 0, dropped: 0 }, "connector timeout")).toBe(
      "connector timeout",
    );
    expect(summarize("failed", { fetched: 0, persisted: 0, dropped: 0 }, null)).toBe("failed");
    expect(summarize("failed", { fetched: 0, persisted: 0, dropped: 0 }, "   ")).toBe("failed");
  });

  it("a running scan is in progress", () => {
    expect(summarize("running", { fetched: 3, persisted: 1, dropped: 0 }, null)).toBe(
      "in progress",
    );
  });
});

describe("scan-run-history: mapScanRun", () => {
  it("maps a row to the view, serializing timestamps to ISO and deriving label + summary", () => {
    const view = mapScanRun(
      row({
        id: "scan-9",
        status: "completed",
        fetchedCount: 4,
        persistedCount: 2,
        droppedCount: 2,
        sourceConfig: { name: "LinkedIn search" },
      }),
    );
    expect(view).toEqual({
      id: "scan-9",
      sourceLabel: "LinkedIn search",
      status: "completed",
      startedOn: "2026-06-04T10:00:00.000Z",
      finishedOn: "2026-06-04T10:00:01.000Z",
      summary: "fetched 4, 2 new, 2 already seen",
      fetched: 4,
      persisted: 2,
      dropped: 2,
    });
  });

  it("leaves finishedOn null for a still-running scan", () => {
    const view = mapScanRun(row({ status: "running", finishedAt: null }));
    expect(view.finishedOn).toBeNull();
    expect(view.summary).toBe("in progress");
  });
});

describe("scan-run-history: assembleScanHistory + unavailable", () => {
  it("wraps mapped rows in an ok snapshot", () => {
    const snap = assembleScanHistory([row({ id: "a" }), row({ id: "b" })]);
    expect(snap.status).toBe("ok");
    if (snap.status !== "ok") return;
    expect(snap.runs.map((r) => r.id)).toEqual(["a", "b"]);
  });

  it("degrades a read failure to a structured unavailable result", () => {
    expect(scanHistoryUnavailable(new Error("connection refused"))).toEqual({
      status: "unavailable",
      reason: "connection refused",
    });
    expect(scanHistoryUnavailable(null)).toEqual({
      status: "unavailable",
      reason: "scan history unavailable",
    });
  });
});

// --- Integration: the Drizzle reader against real Postgres (isolated by cleanup) ---
// Gated on TEST_DATABASE_URL like the other integration suites; skips cleanly without it.

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("scan-run-history: listScanHistory (integration)", () => {
  let getDb: typeof import("@/lib/db").getDb;
  let closeDb: typeof import("@/lib/db").closeDb;
  let listScanHistory: typeof import("@/lib/signals/scan-history").listScanHistory;
  let schema: typeof import("@/lib/db/schema");

  // FK-safe truncate (RESTRICT forbids parent-first): scans references sources.
  async function truncateAll() {
    const db = getDb();
    await db.delete(schema.signals);
    await db.delete(schema.scans);
    await db.delete(schema.sources);
  }

  beforeEach(async () => {
    ({ getDb, closeDb } = await import("@/lib/db"));
    ({ listScanHistory } = await import("@/lib/signals/scan-history"));
    schema = await import("@/lib/db/schema");
    await truncateAll();
  });

  afterEach(truncateAll);

  afterAll(async () => {
    await closeDb();
  });

  async function createSource(config: Record<string, unknown>): Promise<string> {
    const [r] = await getDb()
      .insert(schema.sources)
      .values({ kind: "fixture", config })
      .returning({ id: schema.sources.id });
    return r.id;
  }

  it("returns recorded runs most-recent-first, with the source label and mapped outcome", async () => {
    const sourceId = await createSource({ name: "LinkedIn search" });
    const db = getDb();
    await db.insert(schema.scans).values([
      {
        sourceId,
        status: "completed",
        startedAt: new Date("2026-06-04T09:00:00.000Z"),
        finishedAt: new Date("2026-06-04T09:00:01.000Z"),
        fetchedCount: 0,
        persistedCount: 0,
        droppedCount: 0,
      },
      {
        sourceId,
        status: "completed",
        startedAt: new Date("2026-06-04T11:00:00.000Z"),
        finishedAt: new Date("2026-06-04T11:00:02.000Z"),
        fetchedCount: 12,
        persistedCount: 3,
        droppedCount: 9,
      },
    ]);

    const snap = await listScanHistory();
    expect(snap.status).toBe("ok");
    if (snap.status !== "ok") return;

    expect(snap.runs).toHaveLength(2);
    // Most-recent startedAt first.
    expect(snap.runs[0].startedOn).toBe("2026-06-04T11:00:00.000Z");
    expect(snap.runs[0].sourceLabel).toBe("LinkedIn search");
    expect(snap.runs[0].summary).toBe("fetched 12, 3 new, 9 already seen");
    expect(snap.runs[1].summary).toBe("nothing matched");
  });

  it("bounds the result to the requested limit", async () => {
    const sourceId = await createSource({ name: "S" });
    const db = getDb();
    await db.insert(schema.scans).values(
      [0, 1, 2].map((i) => ({
        sourceId,
        status: "completed" as const,
        startedAt: new Date(Date.UTC(2026, 5, 4, 10, i, 0)),
        finishedAt: new Date(Date.UTC(2026, 5, 4, 10, i, 1)),
        fetchedCount: 1,
        persistedCount: 1,
        droppedCount: 0,
      })),
    );

    const snap = await listScanHistory(2);
    expect(snap.status).toBe("ok");
    if (snap.status !== "ok") return;
    expect(snap.runs).toHaveLength(2);
    // The two most recent (10:02, 10:01), not the oldest (10:00).
    expect(snap.runs.map((r) => r.startedOn)).toEqual([
      "2026-06-04T10:02:00.000Z",
      "2026-06-04T10:01:00.000Z",
    ]);
  });

  it("falls back to the source kind when the config carries no name", async () => {
    const sourceId = await createSource({});
    await getDb()
      .insert(schema.scans)
      .values({
        sourceId,
        status: "failed",
        startedAt: new Date("2026-06-04T08:00:00.000Z"),
        error: "connector exploded",
        fetchedCount: 0,
        persistedCount: 0,
        droppedCount: 0,
      });

    const snap = await listScanHistory();
    expect(snap.status).toBe("ok");
    if (snap.status !== "ok") return;
    expect(snap.runs[0].sourceLabel).toBe("fixture");
    expect(snap.runs[0].status).toBe("failed");
    expect(snap.runs[0].summary).toBe("connector exploded");
  });

  it("degrades to a structured unavailable result when the read fails", async () => {
    // Force the DB read to throw so listScanHistory's degrade-to-unavailable path runs, rather
    // than relying on the live-queue section to blank when only scan history is broken.
    const db = await import("@/lib/db");
    const spy = vi.spyOn(db, "getDb").mockImplementation(() => {
      throw new Error("db down");
    });
    try {
      const snap = await listScanHistory();
      expect(snap.status).toBe("unavailable");
      if (snap.status !== "unavailable") return;
      expect(snap.reason).toBe("db down");
    } finally {
      spy.mockRestore();
    }
  });
});
