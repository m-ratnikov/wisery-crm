import "server-only";
import { eq, type InferSelectModel } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { prospects, signals } from "@/lib/db/schema";
import { type PersonSubject, personSubject } from "@/lib/prospect/identity";

type ProspectRow = InferSelectModel<typeof prospects>;

// Load a prospect by id or throw a precondition error (the worker retries). One
// representation, shared by the actionable-prospect preamble and the prospect-keyed qualify.
export async function loadProspectById(prospectId: string): Promise<ProspectRow> {
  const [prospect] = await getDb()
    .select()
    .from(prospects)
    .where(eq(prospects.id, prospectId))
    .limit(1);
  if (!prospect) {
    throw new Error(`prospect ${prospectId} not found`);
  }
  return prospect;
}

// The shared preamble for the draft and enrich pipelines: load a prospect that is in a
// workable disposition (`qualified` or `queued`) together with its PersonSubject (resolved
// from its signal for a discovered prospect, or its own columns for a manual one - ADR-0010).
// Returns null when the prospect is not workable (below-bar, acted, dismissed, closed, ...),
// which both pipelines treat as a skip; throws if the prospect (or a signal-origin prospect's
// signal) is missing - a precondition error the worker retries. One authoritative
// representation of "is this prospect actionable", origin-agnostic for its consumers.
export async function loadActionableProspect(
  prospectId: string,
): Promise<{ prospect: ProspectRow; subject: PersonSubject } | null> {
  const db = getDb();
  const prospect = await loadProspectById(prospectId);
  if (prospect.status !== "qualified" && prospect.status !== "queued") {
    return null;
  }
  const [signal] = prospect.signalId
    ? await db.select().from(signals).where(eq(signals.id, prospect.signalId)).limit(1)
    : [null];
  // personSubject throws for a signal-origin prospect whose signal is missing (a precondition
  // error to retry); a manual prospect needs no signal.
  return { prospect, subject: personSubject(prospect, signal ?? null) };
}
