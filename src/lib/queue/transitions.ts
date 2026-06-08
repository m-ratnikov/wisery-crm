import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { drafts, outcomes, person, scorings } from "@/lib/db/schema";

// The human-action disposition transitions (review-queue D-C). All tolerant: a transition
// only fires from its valid prior disposition and is otherwise a no-op (idempotent under a
// double-submit or a stale card). The system never sends - acting records a human action (D2).
export type OutcomeResultValue = "connected" | "replied" | "booked" | "no_response";

export interface TransitionOutcome {
  personId: string;
  changed: boolean;
}

// Move a prospect out of `queued` to a terminal-ish disposition; no-op if not queued.
async function transitionFromQueued(
  personId: string,
  to: "acted" | "dismissed",
): Promise<TransitionOutcome> {
  const updated = await getDb()
    .update(person)
    .set({ status: to })
    .where(and(eq(person.id, personId), eq(person.status, "queued")))
    .returning({ id: person.id });
  return { personId, changed: updated.length > 0 };
}

export function actProspect(personId: string): Promise<TransitionOutcome> {
  return transitionFromQueued(personId, "acted");
}

export function dismissProspect(personId: string): Promise<TransitionOutcome> {
  return transitionFromQueued(personId, "dismissed");
}

// Log the outcome of an acted prospect: record it against the score the prospect was acted
// on (D7) and the draft that was sent, then close the prospect. No-op if not `acted`.
// The `acted -> closed` flip is the atomic claim: a conditional UPDATE that only one
// transaction can win, so a double-submit or a stale card inserts exactly one Outcome.
export async function logOutcome(
  personId: string,
  opts: { result: OutcomeResultValue; notes?: string; channel?: string },
): Promise<TransitionOutcome> {
  return getDb().transaction(async (tx) => {
    const closed = await tx
      .update(person)
      .set({ status: "closed" })
      .where(and(eq(person.id, personId), eq(person.status, "acted")))
      .returning({ id: person.id });
    if (closed.length === 0) {
      return { personId, changed: false };
    }

    const [score] = await tx
      .select({ score: scorings.score })
      .from(scorings)
      .where(eq(scorings.personId, personId))
      .orderBy(desc(scorings.scoredAt), desc(scorings.id))
      .limit(1);
    // An acted prospect was qualified, so a Scoring must exist; a missing one is a broken
    // invariant we surface rather than record a fabricated score into the D7 dataset.
    if (!score) {
      throw new Error(`logOutcome: acted prospect ${personId} has no scoring`);
    }
    const [draft] = await tx
      .select({ id: drafts.id })
      .from(drafts)
      .where(and(eq(drafts.personId, personId), eq(drafts.status, "selected")))
      .limit(1);

    await tx.insert(outcomes).values({
      personId,
      draftId: draft?.id ?? null,
      scoreAtTime: score.score,
      result: opts.result,
      channel: opts.channel ?? "linkedin",
      notes: opts.notes ?? null,
    });
    return { personId, changed: true };
  });
}
