import { afterAll, describe, expect, it } from "vitest";
import { checkDbConnection, closeDb } from "@/lib/db";

// platform-runtime: "Application connects to Postgres over a pooled connection"
// Gated on a real local Postgres; skips cleanly when none is configured.
const hasDb = !!process.env.TEST_DATABASE_URL && !!process.env.APP_DATABASE_URL;

describe.skipIf(!hasDb)("platform-runtime: Postgres connectivity", () => {
  afterAll(async () => {
    await closeDb();
  });

  it("round-trips a query through the pooled connection", async () => {
    expect(await checkDbConnection()).toBe(true);
  });
});
