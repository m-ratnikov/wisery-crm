import "server-only";
import { eq } from "drizzle-orm";
import { getDb, type DbTx } from "@/lib/db";
import { prospects, scorings, signals } from "@/lib/db/schema";
import type { LLMProvider } from "@/lib/llm/provider";
import { scoreProspect } from "@/lib/qualify/scorer";
import { gateStatus } from "@/lib/qualify/status";

// The testable qualify core (qualification D-E/D-H): load the signal, fan out to person
// prospect(s), score each against the active rubric, and persist the prospect + its Scoring
// + the gated status. The LLM provider is injectable so tests run against the fake.
export interface QualifyResult {
  signalId: string;
  prospectsCreated: number;
  skipped: boolean;
  // Ids of prospects this run left `qualified` (>= 3). The qualify worker hands these to
  // the enqueue-on-qualify hook so drafting runs for qualified prospects only.
  qualifiedProspectIds: string[];
}

export async function qualifySignal(
  signalId: string,
  opts: {
    llm?: LLMProvider;
    // Enqueue the next stage (drafting, + enrichment when auto) on the SAME transaction as
    // the prospect/scoring write, so a qualified prospect can never be stranded without its
    // handoff job (ADR-0009). Injected by the worker; absent in direct/test calls.
    enqueueNext?: (tx: DbTx, qualifiedProspectIds: string[]) => Promise<void>;
  } = {},
): Promise<QualifyResult> {
  const db = getDb();

  const [signal] = await db.select().from(signals).where(eq(signals.id, signalId)).limit(1);
  if (!signal) {
    throw new Error(`signal ${signalId} not found`);
  }

  // Idempotency (D-F): if this signal already produced a prospect, do nothing - so a
  // re-scan or a job retry never double-scores. Checked before the LLM call to avoid
  // wasted spend. (Best-effort under concurrency; pg-boss does not run a job twice at once.)
  const existing = await db
    .select({ id: prospects.id })
    .from(prospects)
    .where(eq(prospects.signalId, signalId))
    .limit(1);
  if (existing.length > 0) {
    return { signalId, prospectsCreated: 0, skipped: true, qualifiedProspectIds: [] };
  }

  // Fan-out: a person signal yields one prospect (ADR-0005); N>1 expansion is the
  // deferred normalize-expand stage. Score outside the transaction (no network inside a tx).
  const scored = await scoreProspect(signal, opts);
  const status = gateStatus(scored.result.score);

  const prospectId = await db.transaction(async (tx) => {
    const [prospect] = await tx
      .insert(prospects)
      .values({ signalId, status })
      .returning({ id: prospects.id });
    await tx.insert(scorings).values({
      prospectId: prospect.id,
      rubricId: scored.rubricId,
      score: scored.result.score,
      reason: scored.result.reason,
      summary: scored.result.summary,
      provider: scored.provider,
      promptVersion: scored.promptVersion,
      model: scored.model,
    });
    // Hand off inside the transaction: the draft/enrich job commits with the prospect, or
    // not at all (ADR-0009). Only qualified prospects hand off; below-bar ones terminate.
    if (opts.enqueueNext && status === "qualified") {
      await opts.enqueueNext(tx, [prospect.id]);
    }
    return prospect.id;
  });

  return {
    signalId,
    prospectsCreated: 1,
    skipped: false,
    qualifiedProspectIds: status === "qualified" ? [prospectId] : [],
  };
}
