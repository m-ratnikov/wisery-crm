import { describe, expect, it } from "vitest";
import { PgBoss } from "pg-boss";

// background-jobs: "Durable job enqueue and processing"
// Uses an isolated schema so it never touches the dev `pgboss` schema.
const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("background-jobs: enqueue -> process -> complete", () => {
  it("processes an enqueued job through a registered worker", async () => {
    const boss = new PgBoss({
      connectionString: url!,
      application_name: "pgboss-test",
      schema: "pgboss_test",
    });
    await boss.start();
    try {
      const queue = "test-roundtrip";
      await boss.createQueue(queue);

      let resolve!: (value: unknown) => void;
      const processed = new Promise<unknown>((r) => {
        resolve = r;
      });
      await boss.work(queue, (jobs) => {
        resolve(jobs[0].data);
        return Promise.resolve();
      });

      await boss.send(queue, { hello: "world" });
      await expect(processed).resolves.toEqual({ hello: "world" });
    } finally {
      await boss.stop({ graceful: false });
    }
  }, 30000);
});
