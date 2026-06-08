import "server-only";
import { eq } from "drizzle-orm";
import { getDb, type DbTx } from "@/lib/db";
import { person, scorings, signals } from "@/lib/db/schema";
import type { LLMProvider } from "@/lib/llm/provider";
import { personSubject } from "@/lib/prospect/identity";
import { loadProspectById } from "@/lib/prospect/load";
import { type ScoredProspect, scoreProspect } from "@/lib/qualify/scorer";
import { gateStatus, personTypeSchema } from "@/lib/qualify/status";

// The testable scoring core (qualification D-E/D-H). Two entries share one scoring step:
// - qualifySignal: the discovered path - load the signal, create the prospect, score it.
// - qualifyProspect: the on-demand re-score of an existing Person (ADR-0019) - score it by its
//   PersonSubject (signal or its own columns), regardless of origin, writing a fresh Scoring.
// Both write an `llm`-provenance Scoring (a real scorer call), distinct from the no-LLM advisory
// Scoring approval promotes (ADR-0019). The LLM provider is injectable so tests run against the fake.
export interface QualifyResult {
  signalId?: string;
  personId?: string;
  prospectsCreated: number;
  skipped: boolean;
  // Ids of person this run left `qualified` (>= 3).
  qualifiedProspectIds: string[];
}

// Shared tail: write the `llm`-provenance Scoring row for a prospect that already exists in `tx`.
async function persistScore(
  tx: DbTx,
  args: { personId: string; scored: ScoredProspect },
): Promise<void> {
  const { personId, scored } = args;
  await tx.insert(scorings).values({
    personId,
    rubricId: scored.rubricId,
    score: scored.result.score,
    reason: scored.result.reason,
    summary: scored.result.summary,
    provenance: "llm",
    provider: scored.provider,
    promptVersion: scored.promptVersion,
    model: scored.model,
  });
}

export async function qualifySignal(
  signalId: string,
  opts: { llm?: LLMProvider } = {},
): Promise<QualifyResult> {
  const db = getDb();

  const [signal] = await db.select().from(signals).where(eq(signals.id, signalId)).limit(1);
  if (!signal) {
    throw new Error(`signal ${signalId} not found`);
  }

  // Idempotency (D-F): if this signal already produced a prospect, do nothing - so a re-scan
  // or job retry never double-scores. Checked before the LLM call to avoid wasted spend.
  const existing = await db
    .select({ id: person.id })
    .from(person)
    .where(eq(person.signalId, signalId))
    .limit(1);
  if (existing.length > 0) {
    return { signalId, prospectsCreated: 0, skipped: true, qualifiedProspectIds: [] };
  }

  // Fan-out: a person signal yields one prospect (ADR-0005); N>1 expansion is the deferred
  // normalize-expand stage. Score outside the transaction (no network inside a tx). A
  // SignalRow satisfies PersonSubject structurally, so the discovered prompt is unchanged.
  const scored = await scoreProspect(signal, opts);
  const status = gateStatus(scored.result.score);

  const personId = await db.transaction(async (tx) => {
    const [prospect] = await tx
      .insert(person)
      .values({ origin: "signal", signalId, status })
      .returning({ id: person.id });
    await persistScore(tx, { personId: prospect.id, scored });
    return prospect.id;
  });

  return {
    signalId,
    prospectsCreated: 1,
    skipped: false,
    qualifiedProspectIds: status === "qualified" ? [personId] : [],
  };
}

// The on-demand re-score (ADR-0019): synchronous, user-triggered from the Person workspace. It is
// additive and newest-row-wins, so it carries NO scored-already guard - a person usually already
// holds the promoted advisory Scoring, and re-score deliberately supersedes it with a fresh
// `llm`-provenance row. Two fast clicks write two rows (accepted; re-score is rare).
export async function qualifyProspect(
  personId: string,
  opts: { llm?: LLMProvider } = {},
): Promise<QualifyResult> {
  const db = getDb();

  const prospect = await loadProspectById(personId);

  // Re-score is a prospect-only on-demand action (ADR-0019): a peer is engaged via comments, never
  // buyer-scored on demand, and may have no active peer rubric to score against. Skip a non-prospect
  // rather than throw a 500 to the user; its peer-rubric advisory Scoring from approval stands.
  const personType = personTypeSchema.parse(prospect.type);
  if (personType !== "prospect") {
    return { personId, prospectsCreated: 0, skipped: true, qualifiedProspectIds: [] };
  }

  const [signal] = prospect.signalId
    ? await db.select().from(signals).where(eq(signals.id, prospect.signalId)).limit(1)
    : [null];
  // A prospect is scored against the buyer (ICP) rubric (ADR-0017).
  const scored = await scoreProspect(personSubject(prospect, signal ?? null), {
    ...opts,
    rubricKind: "icp",
  });
  const status = gateStatus(scored.result.score);

  await db.transaction(async (tx) => {
    await tx.update(person).set({ status }).where(eq(person.id, personId));
    await persistScore(tx, { personId, scored });
  });

  return {
    personId,
    prospectsCreated: 0,
    skipped: false,
    qualifiedProspectIds: status === "qualified" ? [personId] : [],
  };
}
