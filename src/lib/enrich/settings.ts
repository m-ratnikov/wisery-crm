import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { settings } from "@/lib/db/schema";

// Per-tenant app settings, config-as-data (D1). Single-row for single-tenant MVP; the
// home of the opt-in auto-enrich flag (ADR-0007). getSettings inserts a default row if
// none exists (idempotent), so callers always get a value.
export interface AppSettings {
  id: string;
  autoEnrich: boolean;
}

// A fixed id for the single settings row, so concurrent first-callers cannot create two
// rows: the insert is an idempotent onConflictDoNothing on this PK, and reads/writes always
// target it (single-tenant MVP; `tenant_id` keys this per tenant when productized, D1).
const SETTINGS_ID = "00000000-0000-0000-0000-000000000001";

export async function getSettings(): Promise<AppSettings> {
  const db = getDb();
  await db.insert(settings).values({ id: SETTINGS_ID }).onConflictDoNothing();
  const [row] = await db.select().from(settings).where(eq(settings.id, SETTINGS_ID)).limit(1);
  return { id: row.id, autoEnrich: row.autoEnrich };
}

export async function setAutoEnrich(autoEnrich: boolean): Promise<void> {
  await getSettings(); // ensure the row exists
  await getDb().update(settings).set({ autoEnrich }).where(eq(settings.id, SETTINGS_ID));
}
