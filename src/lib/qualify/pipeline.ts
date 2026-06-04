import "server-only";
import { eq } from "drizzle-orm";
import { getDb, type DbTx } from "@/lib/db";
import { prospects, scorings, signals } from "@/lib/db/schema";
import type { LLMProvider } from "@/lib/llm/provider";
import { personSubject } from "@/lib/prospect/identity";
import { loadProspectById } from "@/lib/prospect/load";
import { type ScoredProspect, scoreProspect } from "@/lib/qualify/scorer";
import { gateStatus } from "@/lib/qualify/status";

// The testable qualify core (qualification D-E/D-H). Two entries share one scoring step:
// - qualifySignal: the discovered path - load the signal, create the prospect, score it.
// - qualifyProspect: an existing prospect (a manual lead, ADR-0010, or a re-qualify) - score
//   it by its PersonSubject (signal or its own columns), regardless of origin.
// The LLM provider is injectable so tests run against the fake.
export interface QualifyResult {
  signalId?: string;
  prospectId?: string;
  prospectsCreated: number;
  skipped: boolean;
  // Ids of prospects this run left `qualified` (>= 3). The worker hands these to the
  // enqueue-on-qualify hook so drafting runs for qualified prospects only.
  qualifiedProspectIds: string[];
}

type EnqueueNext = (tx: DbTx, qualifiedProspectIds: string[]) => Promise<void>;

// Shared tail: write the Scoring row for a prospect that already exists in `tx`, and hand off
// the next stage for a qualified one (ADR-0009 - the scoring and its handoff commit together).
async function persistScore(
  tx: DbTx,
  args: { prospectId: string; scored: ScoredProspect; status: string; enqueueNext?: EnqueueNext },
): Promise<void> {
  const { prospectId, scored, status, enqueueNext } = args;
  await tx.insert(scorings).values({
    prospectId,
    rubricId: scored.rubricId,
    score: scored.result.score,
    reason: scored.result.reason,
    summary: scored.result.summary,
    provider: scored.provider,
    promptVersion: scored.promptVersion,
    model: scored.model,
  });
  if (enqueueNext && status === "qualified") {
    await enqueueNext(tx, [prospectId]);
  }
}

export async function qualifySignal(
  signalId: string,
  opts: {
    llm?: LLMProvider;
    // Enqueue the next stage (drafting, + enrichment when auto) on the SAME transaction as
    // the prospect/scoring write, so a qualified prospect can never be stranded without its
    // handoff job (ADR-0009). Injected by the worker; absent in direct/test calls.
    enqueueNext?: EnqueueNext;
  } = {},
): Promise<QualifyResult> {
  const db = getDb();

  const [signal] = await db.select().from(signals).where(eq(signals.id, signalId)).limit(1);
  if (!signal) {
    throw new Error(`signal ${signalId} not found`);
  }

  // Idempotency (D-F): if this signal already produced a prospect, do nothing - so a re-scan
  // or job retry never double-scores. Checked before the LLM call to avoid wasted spend.
  const existing = await db
    .select({ id: prospects.id })
    .from(prospects)
    .where(eq(prospects.signalId, signalId))
    .limit(1);
  if (existing.length > 0) {
    return { signalId, prospectsCreated: 0, skipped: true, qualifiedProspectIds: [] };
  }

  // Fan-out: a person signal yields one prospect (ADR-0005); N>1 expansion is the deferred
  // normalize-expand stage. Score outside the transaction (no network inside a tx). A
  // SignalRow satisfies PersonSubject structurally, so the discovered prompt is unchanged.
  const scored = await scoreProspect(signal, opts);
  const status = gateStatus(scored.result.score);

  const prospectId = await db.transaction(async (tx) => {
    const [prospect] = await tx
      .insert(prospects)
      .values({ origin: "signal", signalId, status })
      .returning({ id: prospects.id });
    await persistScore(tx, {
      prospectId: prospect.id,
      scored,
      status,
      enqueueNext: opts.enqueueNext,
    });
    return prospect.id;
  });

  return {
    signalId,
    prospectsCreated: 1,
    skipped: false,
    qualifiedProspectIds: status === "qualified" ? [prospectId] : [],
  };
}

export async function qualifyProspect(
  prospectId: string,
  opts: { llm?: LLMProvider; enqueueNext?: EnqueueNext } = {},
): Promise<QualifyResult> {
  const db = getDb();

  const prospect = await loadProspectById(prospectId);

  // Idempotency: a prospect already scored is left alone, so a re-qualify (the manual-add
  // recovery) or a job retry never double-scores. Keyed on the prospect (not the signal,
  // which a manual prospect lacks).
  const scoredAlready = await db
    .select({ id: scorings.id })
    .from(scorings)
    .where(eq(scorings.prospectId, prospectId))
    .limit(1);
  if (scoredAlready.length > 0) {
    return { prospectId, prospectsCreated: 0, skipped: true, qualifiedProspectIds: [] };
  }

  const [signal] = prospect.signalId
    ? await db.select().from(signals).where(eq(signals.id, prospect.signalId)).limit(1)
    : [null];
  const scored = await scoreProspect(personSubject(prospect, signal ?? null), opts);
  const status = gateStatus(scored.result.score);

  await db.transaction(async (tx) => {
    await tx.update(prospects).set({ status }).where(eq(prospects.id, prospectId));
    await persistScore(tx, { prospectId, scored, status, enqueueNext: opts.enqueueNext });
  });

  return {
    prospectId,
    prospectsCreated: 0,
    skipped: false,
    qualifiedProspectIds: status === "qualified" ? [prospectId] : [],
  };
}
