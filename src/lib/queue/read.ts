import "server-only";
import { desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { dossiers, drafts, prospects, scorings } from "@/lib/db/schema";
import { nameFromPayload, prospectsWithSignal } from "@/lib/prospect/read";

// The review-queue read-model (review-queue D-B): the open worklist - prospects that are
// `queued` (review + act) or `acted` (awaiting an outcome log) - with everything a card
// needs: name, status, latest score + reason, the selected draft body, and whether a
// dossier exists. Composed from small queries to avoid join multiplicity.
export interface QueueItem {
  id: string;
  status: string;
  name: string;
  score: number | null;
  reason: string | null;
  draft: string | null;
  enriched: boolean;
  createdAt: Date;
}

export async function listQueue(): Promise<QueueItem[]> {
  const db = getDb();

  const base = await prospectsWithSignal()
    .where(inArray(prospects.status, ["queued", "acted"]))
    .orderBy(desc(prospects.createdAt));

  const scoreRows = await db
    .select({ prospectId: scorings.prospectId, score: scorings.score, reason: scorings.reason })
    .from(scorings)
    .orderBy(desc(scorings.scoredAt), desc(scorings.id));
  const latestScore = new Map<string, { score: number; reason: string | null }>();
  for (const r of scoreRows) {
    if (!latestScore.has(r.prospectId))
      latestScore.set(r.prospectId, { score: r.score, reason: r.reason });
  }

  const draftBody = new Map(
    (
      await db
        .select({ prospectId: drafts.prospectId, body: drafts.body })
        .from(drafts)
        .where(eq(drafts.status, "selected"))
    ).map((r) => [r.prospectId, r.body]),
  );
  const enrichedIds = new Set(
    (await db.select({ id: dossiers.prospectId }).from(dossiers)).map((r) => r.id),
  );

  return base.map((r) => ({
    id: r.id,
    status: r.status,
    name: nameFromPayload(r.payload, r.signalKind),
    score: latestScore.get(r.id)?.score ?? null,
    reason: latestScore.get(r.id)?.reason ?? null,
    draft: draftBody.get(r.id) ?? null,
    enriched: enrichedIds.has(r.id),
    createdAt: r.createdAt,
  }));
}
