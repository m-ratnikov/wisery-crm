import "server-only";
import { desc, eq, isNull } from "drizzle-orm";
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

export async function listTriage(): Promise<TriageItem[]> {
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
    .where(isNull(signalDecisions.id))
    .orderBy(desc(signals.createdAt));
}
