import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PgBoss, fromDrizzle } from "pg-boss";
import { sql } from "drizzle-orm";

// ADR-0009: a pipeline stage enqueues its follow-on job ON the same Drizzle transaction as
// its state write (via pg-boss's fromDrizzle adapter), so the two commit together or roll
// back together - no strand window. This proves the mechanism the jobs facade's enqueueInTx
// uses: the job INSERT rides the app transaction. Uses an isolated pgboss schema so it never
// touches the dev queue (same pattern as backbone-jobs). Gated like the other DB suites.
const url = process.env.TEST_DATABASE_URL;
const hasDb = !!url && !!process.env.APP_DATABASE_URL;

describe.skipIf(!hasDb)("atomic enqueue-in-transaction (ADR-0009)", () => {
  let getDb: typeof import("@/lib/db").getDb;
  let closeDb: typeof import("@/lib/db").closeDb;
  let boss: PgBoss;
  const QUEUE = "atomic-handoff-probe";

  beforeAll(async () => {
    ({ getDb, closeDb } = await import("@/lib/db"));
    boss = new PgBoss({
      connectionString: url!,
      application_name: "pgboss-test",
      schema: "pgboss_test_atomic",
    });
    await boss.start();
    try {
      await boss.createQueue(QUEUE, { policy: "singleton" });
    } catch {
      // queue already exists from a prior run - fine
    }
  }, 30000);

  afterAll(async () => {
    await boss.stop({ graceful: false });
    await closeDb();
  });

  it("lands the job when the transaction commits", async () => {
    let jobId: string | null = null;
    await getDb().transaction(async (tx) => {
      jobId = await boss.send(
        QUEUE,
        { case: "commit" },
        { singletonKey: "commit", db: fromDrizzle(tx, sql) },
      );
    });
    expect(jobId).toBeTruthy();
    const job = await boss.getJobById(QUEUE, jobId!);
    expect(job?.data).toEqual({ case: "commit" });
  });

  it("lands NO job when the transaction rolls back (no strand, no orphan job)", async () => {
    let jobId: string | null = null;
    await expect(
      getDb().transaction(async (tx) => {
        jobId = await boss.send(
          QUEUE,
          { case: "rollback" },
          { singletonKey: "rollback", db: fromDrizzle(tx, sql) },
        );
        // The state write that would follow fails: the whole transaction, INCLUDING the
        // job INSERT enqueued above, must roll back.
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    // send returned an id inside the transaction, but the row was never committed.
    expect(jobId).toBeTruthy();
    expect(await boss.getJobById(QUEUE, jobId!)).toBeFalsy();
  });
});
