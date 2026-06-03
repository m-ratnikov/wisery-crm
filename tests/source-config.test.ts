import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { isConnectorRegistered } from "@/lib/signals/registry";

// --- Unit: connector registry membership (no DB) ---
describe("connector registry membership", () => {
  it("reports the fixture registered and adapter-pending kinds not", () => {
    expect(isConnectorRegistered("fixture")).toBe(true);
    expect(isConnectorRegistered("linkedin-search")).toBe(false);
  });
});

// Source read/write helpers (src/lib/signals/sources) used by the config anchor view.
// Gated on TEST_DATABASE_URL like the other integration suites.
const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("source config helpers (integration)", () => {
  let getDb: typeof import("@/lib/db").getDb;
  let closeDb: typeof import("@/lib/db").closeDb;
  let schema: typeof import("@/lib/db/schema");
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
    sources = await import("@/lib/signals/sources");
    await truncateAll();
  });

  afterEach(truncateAll);
  afterAll(async () => {
    await closeDb();
  });

  it("creates a source (enabled by default) and lists it", async () => {
    const created = await sources.createSource({ kind: "fixture", config: { name: "demo" } });
    expect(created.enabled).toBe(true);
    const all = await sources.listSources();
    expect(all.map((s) => s.id)).toContain(created.id);
  });

  it("toggles a source's enabled flag", async () => {
    const created = await sources.createSource({ kind: "fixture", config: {} });
    await sources.setSourceEnabled(created.id, false);
    const [row] = (await sources.listSources()).filter((s) => s.id === created.id);
    expect(row.enabled).toBe(false);
  });
});
