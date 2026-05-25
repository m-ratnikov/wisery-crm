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
