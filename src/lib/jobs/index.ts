import "server-only";
import { PgBoss, fromDrizzle, type Job, type JobWithMetadata, type SendOptions } from "pg-boss";
import { sql } from "drizzle-orm";
import { getConfig } from "@/lib/config/env";
import type { DbTx } from "@/lib/db";
import { logger } from "@/lib/log";
import { assembleActivity, assembleSchedules, unavailable } from "@/lib/jobs/activity-map";
import type { JobActivitySnapshot, ScheduleSnapshot } from "@/lib/jobs/activity-view";

// pg-boss reached through a thin facade (ADR-0004): one localized call site, not
// a portability seam. It holds its OWN pool/connection, separate from the app's
// Drizzle pool (ADR-0001).
const HEARTBEAT_QUEUE = "heartbeat";

// Pin the singleton to globalThis. instrumentation.ts (which calls start() and
// registers the workers) and Server Actions / route handlers can resolve to
// SEPARATE instances of this module under Next + Turbopack; a plain module-level
// `let` would give the action an unstarted, worker-less boss ("Database not
// opened"). globalThis is shared across those module contexts and survives HMR,
// so every caller reaches the one started instance that owns the workers.
const BOSS_KEY = Symbol.for("wisery.pgboss");
type BossGlobal = typeof globalThis & { [BOSS_KEY]?: PgBoss };
const bossGlobal = globalThis as BossGlobal;

export function getBoss(): PgBoss {
  if (!bossGlobal[BOSS_KEY]) {
    const cfg = getConfig();
    const instance = new PgBoss({
      connectionString: cfg.pgbossDatabaseUrl,
      max: cfg.pgbossDbPoolMax,
      application_name: "pgboss",
    });
    instance.on("error", (err) => logger.error({ err }, "pg-boss error"));
    bossGlobal[BOSS_KEY] = instance;
  }
  return bossGlobal[BOSS_KEY];
}

export async function enqueue<T extends object>(
  queue: string,
  data: T,
  options?: SendOptions,
): Promise<string | null> {
  return getBoss().send(queue, data, options);
}

// Enqueue a job ON an existing Drizzle transaction (ADR-0009): the job INSERT rides the
// caller's transaction and connection via pg-boss's Drizzle adapter, so a stage's state
// write and its follow-on job commit together or roll back together - no strand window.
// Requires pg-boss to share the app's Postgres database (the default); a split pg-boss
// database cannot be written in the app's transaction. Use this for pipeline handoffs;
// the fire-and-forget `enqueue` above stays for user-triggered (manual/batch) enqueues.
export async function enqueueInTx<T extends object>(
  tx: DbTx,
  queue: string,
  data: T,
  options?: SendOptions,
): Promise<string | null> {
  return getBoss().send(queue, data, { ...options, db: fromDrizzle(tx, sql) });
}

export async function work<T>(
  queue: string,
  handler: (jobs: Job<T>[]) => Promise<void>,
): Promise<string> {
  return getBoss().work<T>(queue, handler);
}

// Delete a pg-boss queue. Best-effort by contract (ADR-0019 one-time cleanup of the orphaned
// `draft`/`qualify-prospect` queues): a missing queue is a no-op for the caller, so failures are
// swallowed and logged rather than crashing bootstrap.
export async function deleteQueue(queue: string): Promise<void> {
  try {
    await getBoss().deleteQueue(queue);
  } catch (err) {
    logger.warn({ err, queue }, "deleteQueue failed (queue may not exist)");
  }
}

// Read-only job-activity introspection (job-activity-monitor). Thin pg-boss I/O only; the pure
// raw -> DTO mapping lives in ./activity-map (the testable half). Composed from cheap sources only -
// never an unfiltered findJobs (no SQL LIMIT; it would page the once-a-minute heartbeat queue's
// retained completed-job history):
//   - getQueues(): per-queue counts (one aggregated query)
//   - getWipData(): an IN-MEMORY snapshot of this process's workers (no SQL) for what each queue
//     is running now and its last error - populated only because the boss is a globalThis
//     singleton shared with the bootstrap that registered the workers
//   - findJobs(name, { queued: true }): the individual WAITING jobs (SQL filters state < active,
//     i.e. created + retry), bounded by real backlog, never the completed history
export async function listJobActivity(): Promise<JobActivitySnapshot> {
  let queues, wip, waitingByQueue;
  try {
    const boss = getBoss();
    queues = await boss.getQueues();
    // getWipData is a single synchronous in-memory snapshot taken before any await, so it is
    // internally consistent (not torn across the per-queue awaits below). The snapshot and the
    // findJobs rows are deliberately point-in-time-independent - polling tolerates that skew; do
    // NOT wrap this in a transaction (that would couple the read to the app's connection budget,
    // the exact web/worker seam ADR-0001 keeps separate).
    wip = boss.getWipData({ includeInternal: true });
    waitingByQueue = new Map<string, JobWithMetadata[]>();
    for (const q of queues) {
      waitingByQueue.set(q.name, await boss.findJobs(q.name, { queued: true }));
    }
  } catch (err) {
    // Only the pg-boss I/O is guarded: an unstarted runtime (DB not opened) degrades to a
    // structured unavailable result, logged so a real fault stays observable. The pure mapping
    // below runs OUTSIDE this catch so a mapper bug surfaces as a real error, never masquerades
    // as "runtime not running".
    logger.warn({ err }, "job activity unavailable (runtime not started?)");
    return unavailable(err);
  }
  return assembleActivity(queues, wip, waitingByQueue);
}

export async function listSchedules(): Promise<ScheduleSnapshot> {
  try {
    return assembleSchedules(await getBoss().getSchedules());
  } catch (err) {
    logger.warn({ err }, "schedules unavailable (runtime not started?)");
    return unavailable(err);
  }
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
  const boss = bossGlobal[BOSS_KEY];
  if (boss) {
    await boss.stop({ graceful: true });
    bossGlobal[BOSS_KEY] = undefined;
  }
}
