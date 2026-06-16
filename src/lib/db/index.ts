import "server-only";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { getConfig } from "@/lib/config/env";
import * as schema from "@/lib/db/schema";

// Lazy singletons: the pool/socket opens on first use, not on import, so
// importing this module has no side effects (testable, no stray connections).
let pool: Pool | undefined;
let dbInstance: ReturnType<typeof drizzle<typeof schema>> | undefined;

export function getPool(): Pool {
  if (!pool) {
    const cfg = getConfig();
    pool = new Pool({ connectionString: cfg.appDatabaseUrl, max: cfg.appDbPoolMax });
  }
  return pool;
}

export function getDb() {
  if (!dbInstance) dbInstance = drizzle(getPool(), { schema });
  return dbInstance;
}

// The top-level db handle. A stage's persist helper takes `Db | DbTx` so it runs either standalone
// (a single insert that needs no transaction) or inside a `db.transaction` (e.g. approval's
// entity + decision writes, atomic).
export type Db = ReturnType<typeof getDb>;

// The transaction handle drizzle passes to a `db.transaction(async (tx) => ...)` callback.
// Named here so a stage can take an injected `enqueueNext(tx, ...)` that enqueues the next
// pipeline job on the SAME transaction (atomic handoff, ADR-0009) without leaking drizzle
// internals into every signature.
export type DbTx = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];

// Walking-skeleton connectivity probe (used by the health route + tests).
export async function checkDbConnection(): Promise<boolean> {
  const { rows } = await getPool().query<{ ok: number }>("select 1 as ok");
  return rows[0]?.ok === 1;
}

export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = undefined;
    dbInstance = undefined;
  }
}
