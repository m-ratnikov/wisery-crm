import "server-only";
import { eq, type InferSelectModel } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { prospects, signals } from "@/lib/db/schema";
import type { SignalRow } from "@/lib/signals/connector";

type ProspectRow = InferSelectModel<typeof prospects>;

// The shared preamble for the draft and enrich pipelines: load a prospect that is in a
// workable disposition (`qualified` or `queued`) together with its signal. Returns null
// when the prospect is not workable (below-bar, acted, dismissed, closed, ...), which both
// pipelines treat as a skip; throws if the prospect or its signal is missing (a precondition
// error the worker retries). One authoritative representation of "is this prospect actionable".
export async function loadActionableProspect(
  prospectId: string,
): Promise<{ prospect: ProspectRow; signal: SignalRow } | null> {
  const db = getDb();
  const [prospect] = await db.select().from(prospects).where(eq(prospects.id, prospectId)).limit(1);
  if (!prospect) {
    throw new Error(`prospect ${prospectId} not found`);
  }
  if (prospect.status !== "qualified" && prospect.status !== "queued") {
    return null;
  }
  const [signal] = await db
    .select()
    .from(signals)
    .where(eq(signals.id, prospect.signalId))
    .limit(1);
  if (!signal) {
    throw new Error(`signal for prospect ${prospectId} not found`);
  }
  return { prospect, signal };
}
