import "server-only";
import { enqueue, enqueueInTx, getBoss, work } from "@/lib/jobs";
import type { DbTx } from "@/lib/db";
import { draftProspect } from "@/lib/draft/pipeline";

// One draft job per prospect over the jobs facade. The enqueue-on-qualify wiring lives at
// the composition root (bootstrap), so qualification never imports drafting - the same
// dependency-safe seam as scan -> qualify (drafting D-E).
const DRAFT_QUEUE = "draft";

// User-triggered (fire-and-forget) draft enqueue: the prospect-list "Regenerate" action
// (force) and any other out-of-pipeline trigger. singletonKey + the queue's singleton policy
// keep at most one active draft job per prospect; the has-selected-draft guard in
// draftProspect handles the rest. `force` drives a re-draft.
export async function enqueueDraft(prospectId: string, force = false): Promise<string | null> {
  return enqueue(DRAFT_QUEUE, { prospectId, force }, { singletonKey: prospectId });
}

// Pipeline handoff: enqueue the draft ON the caller's transaction (the qualify prospect-write
// tx, or the enrich dossier-upsert tx for the forced re-draft), so the prospect's state and
// its draft job commit atomically (ADR-0009).
export async function enqueueDraftInTx(
  tx: DbTx,
  prospectId: string,
  force = false,
): Promise<string | null> {
  return enqueueInTx(tx, DRAFT_QUEUE, { prospectId, force }, { singletonKey: prospectId });
}

export async function registerDraftWorker(): Promise<void> {
  await getBoss().createQueue(DRAFT_QUEUE, { policy: "singleton" });
  // Let handler errors propagate so pg-boss retries transient failures and dead-letters
  // poison (ADR-0001) - no error-swallowing catch (review-remediation S1).
  await work<{ prospectId: string; force?: boolean }>(DRAFT_QUEUE, async (jobs) => {
    for (const job of jobs) {
      await draftProspect(job.data.prospectId, { force: job.data.force });
    }
  });
}
