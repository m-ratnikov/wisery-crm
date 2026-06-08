import "server-only";
import { and, desc, eq, gte, isNull } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { signalAdvisory, signalDecisions, signals } from "@/lib/db/schema";

// The triage lane read-model (universal-triage, ADR-0013/0014): pending signals - those with no
// SignalDecision row (`pending` = the absence of a row) - annotated with the advisory hint. The
// LEFT JOIN on signal_decisions filtered to NULL is the inbox; a re-scan re-encounters the same
// signal but a decided one is excluded here, so a dismissal cannot resurface it.
export interface TriageItem {
  signalId: string;
  kind: string;
  payload: unknown;
  createdAt: Date;
  advisoryScore: number | null;
  advisoryKind: string | null;
  advisoryReason: string | null;
}

// `minScore`: keep only items whose advisory score is at least the floor. It is added to the
// WHERE alongside the pending filter, NOT moved onto the join's ON clause, so the LEFT JOIN
// anti-strand shape holds (a pending signal is never dropped by an absent decision row). Without
// the filter an un-scored signal (null advisory) still appears; with it, a null advisory fails
// `>=` and is excluded - the explicit "show me only scored, qualifying signals" Queue view.
export async function listTriage(opts: { minScore?: number } = {}): Promise<TriageItem[]> {
  const pending = isNull(signalDecisions.id);
  const where =
    opts.minScore === undefined ? pending : and(pending, gte(signalAdvisory.score, opts.minScore));
  return getDb()
    .select({
      signalId: signals.id,
      kind: signals.kind,
      payload: signals.payload,
      createdAt: signals.createdAt,
      advisoryScore: signalAdvisory.score,
      advisoryKind: signalAdvisory.rubricKind,
      advisoryReason: signalAdvisory.reason,
    })
    .from(signals)
    .leftJoin(signalDecisions, eq(signals.id, signalDecisions.signalId))
    .leftJoin(signalAdvisory, eq(signals.id, signalAdvisory.signalId))
    .where(where)
    .orderBy(desc(signals.createdAt));
}
