import "server-only";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { sources } from "@/lib/db/schema";
import type { SourceRow } from "@/lib/signals/connector";

// Source read/write helpers so the config UI (icp-config) and any caller manage sources
// through one seam rather than touching the data layer directly. The scan pipeline and
// connector contract live alongside in src/lib/signals; this is the configuration side.

export async function listSources(): Promise<SourceRow[]> {
  return getDb().select().from(sources).orderBy(desc(sources.createdAt));
}

export async function setSourceEnabled(id: string, enabled: boolean): Promise<void> {
  await getDb().update(sources).set({ enabled }).where(eq(sources.id, id));
}

export async function createSource(input: {
  kind: string;
  config: Record<string, unknown>;
}): Promise<SourceRow> {
  const [row] = await getDb()
    .insert(sources)
    .values({ kind: input.kind, config: input.config })
    .returning();
  return row;
}
