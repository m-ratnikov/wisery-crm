import "server-only";
import { eq, type InferSelectModel } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { person, signals } from "@/lib/db/schema";
import { type PersonSubject, personSubject } from "@/lib/prospect/identity";

type ProspectRow = InferSelectModel<typeof person>;

// Load a prospect by id or throw a precondition error (the worker retries). One
// representation, shared by the subject-resolving preamble below.
export async function loadProspectById(personId: string): Promise<ProspectRow> {
  const [prospect] = await getDb().select().from(person).where(eq(person.id, personId)).limit(1);
  if (!prospect) {
    throw new Error(`prospect ${personId} not found`);
  }
  return prospect;
}

// The preamble for the enrich pipeline: load a prospect together with its PersonSubject (resolved
// from its signal for a discovered prospect, or its own columns for a manual one - ADR-0010).
// Every approved or hand-added person is workable - the human's triage verdict is the gate
// (ADR-0022), there is no qualification read. Throws if the prospect (or a signal-origin
// prospect's signal) is missing - a precondition error the worker retries.
export async function loadProspectSubject(
  personId: string,
): Promise<{ prospect: ProspectRow; subject: PersonSubject }> {
  const db = getDb();
  const prospect = await loadProspectById(personId);
  const [signal] = prospect.signalId
    ? await db.select().from(signals).where(eq(signals.id, prospect.signalId)).limit(1)
    : [null];
  // personSubject throws for a signal-origin prospect whose signal is missing (a precondition
  // error to retry); a manual prospect needs no signal.
  return { prospect, subject: personSubject(prospect, signal ?? null) };
}
