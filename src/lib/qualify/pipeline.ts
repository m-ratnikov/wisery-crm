import "server-only";
import { eq } from "drizzle-orm";
import { type Db, type DbTx, getDb } from "@/lib/db";
import { person, scorings, signals } from "@/lib/db/schema";
import { getActiveRubric } from "@/lib/icp/config";
import { BUYER_RUBRIC_KIND } from "@/lib/icp/schema";
import type { LLMProvider } from "@/lib/llm/provider";
import { getEntryStatus } from "@/lib/pipeline/config";
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
  // Ids of person this run scored at or above the bar (>= 3). Qualification is now a derived read
  // (ADR-0019/0020), not a stored status; this is the just-computed score, surfaced for the caller.
  qualifiedProspectIds: string[];
}

// Shared tail: write the `llm`-provenance Scoring row for a prospect. Takes `Db | DbTx` so the
// discovered path runs it inside its prospect-insert transaction and re-score runs it standalone.
async function persistScore(
  db: Db | DbTx,
  args: { personId: string; scored: ScoredProspect },
): Promise<void> {
  const { personId, scored } = args;
  await db.insert(scorings).values({
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
  // The prospect enters the default pipeline at its entry status (ADR-0020); qualification is the
  // read over the Scoring just written, not a status. Resolve the entry before the tx (ADR-0009).
  const entry = await getEntryStatus();

  const personId = await db.transaction(async (tx) => {
    const [prospect] = await tx
      .insert(person)
      .values({
        origin: "signal",
        signalId,
        pipelineId: entry.pipelineId,
        statusId: entry.statusId,
      })
      .returning({ id: person.id });
    await persistScore(tx, { personId: prospect.id, scored });
    return prospect.id;
  });

  return {
    signalId,
    prospectsCreated: 1,
    skipped: false,
    qualifiedProspectIds: gateStatus(scored.result.score) === "qualified" ? [personId] : [],
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

  // Skip (do not throw) when no buyer rubric is configured yet: an unassessed prospect created
  // before the operator set up an ICP rubric would otherwise have its only outbound action (re-score)
  // 500 from scoreProspect, stranding it. Skipping keeps the person `unassessed` and recoverable once
  // a rubric exists, mirroring the peer skip above.
  if (!(await getActiveRubric(BUYER_RUBRIC_KIND))) {
    return { personId, prospectsCreated: 0, skipped: true, qualifiedProspectIds: [] };
  }

  const [signal] = prospect.signalId
    ? await db.select().from(signals).where(eq(signals.id, prospect.signalId)).limit(1)
    : [null];
  // A prospect is scored against the buyer (ICP) rubric (ADR-0017).
  const scored = await scoreProspect(personSubject(prospect, signal ?? null), {
    ...opts,
    rubricKind: BUYER_RUBRIC_KIND,
  });

  // Re-score writes only the fresh `llm` Scoring; it does NOT touch the pipeline position
  // (Person.status_id is the operator's column now, not qualification - ADR-0020). Qualification is
  // the read over this new Scoring.
  await persistScore(db, { personId, scored });

  return {
    personId,
    prospectsCreated: 0,
    skipped: false,
    qualifiedProspectIds: gateStatus(scored.result.score) === "qualified" ? [personId] : [],
  };
}
