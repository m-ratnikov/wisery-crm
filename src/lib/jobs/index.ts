import "server-only";
import { PgBoss, type Job, type SendOptions } from "pg-boss";
import { getConfig } from "@/lib/config/env";
import { logger } from "@/lib/log";

// pg-boss reached through a thin facade (ADR-0004): one localized call site, not
// a portability seam. It holds its OWN pool/connection, separate from the app's
// Drizzle pool (ADR-0001).
const HEARTBEAT_QUEUE = "heartbeat";

let boss: PgBoss | undefined;

export function getBoss(): PgBoss {
  if (!boss) {
    const cfg = getConfig();
    const instance = new PgBoss({
      connectionString: cfg.pgbossDatabaseUrl,
      max: cfg.pgbossDbPoolMax,
      application_name: "pgboss",
    });
    instance.on("error", (err) => logger.error({ err }, "pg-boss error"));
    boss = instance;
  }
  return boss;
}

export async function enqueue<T extends object>(
  queue: string,
  data: T,
  options?: SendOptions,
): Promise<string | null> {
  return getBoss().send(queue, data, options);
}

export async function work<T>(
  queue: string,
  handler: (jobs: Job<T>[]) => Promise<void>,
): Promise<string> {
  return getBoss().work<T>(queue, handler);
}

export async function startJobs(): Promise<void> {
  const b = getBoss();
  await b.start(); // creates the pgboss schema, starts the poller, cron, maintenance
  await b.createQueue(HEARTBEAT_QUEUE);
  await b.work(HEARTBEAT_QUEUE, (jobs) => {
    logger.info({ queue: HEARTBEAT_QUEUE, count: jobs.length }, "heartbeat tick");
    return Promise.resolve(); // no async work yet; WorkHandler requires a Promise
  });
  await b.schedule(HEARTBEAT_QUEUE, "* * * * *"); // every minute - proves the in-process worker runs
  logger.info("background jobs started (pg-boss, in-process)");
}

export async function stopJobs(): Promise<void> {
  if (boss) {
    await boss.stop({ graceful: true });
    boss = undefined;
  }
}
