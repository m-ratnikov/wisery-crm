import "server-only";
import { eq, type InferSelectModel } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { person, signals } from "@/lib/db/schema";
import { type PersonSubject, personSubject } from "@/lib/prospect/identity";

type ProspectRow = InferSelectModel<typeof person>;

// Load a prospect by id or throw a precondition error (the worker retries). One
// representation, shared by the actionable-prospect preamble and the prospect-keyed qualify.
export async function loadProspectById(personId: string): Promise<ProspectRow> {
  const [prospect] = await getDb().select().from(person).where(eq(person.id, personId)).limit(1);
  if (!prospect) {
    throw new Error(`prospect ${personId} not found`);
  }
  return prospect;
}

// The preamble for the enrich pipeline: load a prospect in a workable disposition (`qualified`)
// together with its PersonSubject (resolved from its signal for a discovered prospect, or its own
// columns for a manual one - ADR-0010). Returns null when the prospect is not workable (new,
// below-bar), which the pipeline treats as a skip; throws if the prospect (or a signal-origin
// prospect's signal) is missing - a precondition error the worker retries. One authoritative
// representation of "is this prospect actionable", origin-agnostic for its consumers.
export async function loadActionableProspect(
  personId: string,
): Promise<{ prospect: ProspectRow; subject: PersonSubject } | null> {
  const db = getDb();
  const prospect = await loadProspectById(personId);
  if (prospect.status !== "qualified") {
    return null;
  }
  const [signal] = prospect.signalId
    ? await db.select().from(signals).where(eq(signals.id, prospect.signalId)).limit(1)
    : [null];
  // personSubject throws for a signal-origin prospect whose signal is missing (a precondition
  // error to retry); a manual prospect needs no signal.
  return { prospect, subject: personSubject(prospect, signal ?? null) };
}
