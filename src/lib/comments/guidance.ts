import "server-only";
import { desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { commentGuidance } from "@/lib/db/schema";

// The global comment guidance as config-as-data (engagement-comments, ADR-0018): a single active,
// versioned row read by comment generation, edited in settings. Edits are additive new versions
// (never in place), the same discipline as Rubric and User Profile.
export const commentGuidanceSchema = z.object({
  tone: z.string(),
  rules: z.array(z.string()).default([]),
});
export type CommentGuidanceData = z.infer<typeof commentGuidanceSchema>;

export interface ActiveGuidance {
  id: string;
  version: number;
  guidance: CommentGuidanceData;
}

export async function getActiveGuidance(): Promise<ActiveGuidance | null> {
  const [row] = await getDb()
    .select()
    .from(commentGuidance)
    .where(eq(commentGuidance.active, true))
    .orderBy(desc(commentGuidance.version))
    .limit(1);
  if (!row) return null;
  return { id: row.id, version: row.version, guidance: commentGuidanceSchema.parse(row.guidance) };
}

export async function saveGuidance(input: CommentGuidanceData): Promise<ActiveGuidance> {
  const guidance = commentGuidanceSchema.parse(input);
  return getDb().transaction(async (tx) => {
    await tx.update(commentGuidance).set({ active: false }).where(eq(commentGuidance.active, true));
    const [{ max }] = await tx
      .select({ max: sql<number>`coalesce(max(${commentGuidance.version}), 0)::int` })
      .from(commentGuidance);
    const [row] = await tx
      .insert(commentGuidance)
      .values({ guidance, version: max + 1, active: true })
      .returning();
    return { id: row.id, version: row.version, guidance };
  });
}
