import "server-only";
import { enqueueInTx, getBoss, work } from "@/lib/jobs";
import type { DbTx } from "@/lib/db";
import { runAdvisoryFilter } from "@/lib/triage/advisory";

// The advisory filter as its own pg-boss queue (universal-triage, ADR-0013): every persisted signal
// gets one advisory-filter job, enqueued INSIDE the signal's insert transaction (ADR-0009) but run
// later on the worker, OUTSIDE any transaction - so the per-signal LLM call never sits in the scan
// tx, and the cost is bounded by this queue's own concurrency rather than the scan's. Its own queue,
// not the qualify queue, keeps that boundary explicit.
const ADVISORY_QUEUE = "advisory-filter";

export async function enqueueAdvisoryFilterInTx(
  tx: DbTx,
  signalId: string,
): Promise<string | null> {
  return enqueueInTx(tx, ADVISORY_QUEUE, { signalId }, { singletonKey: signalId });
}

export async function registerAdvisoryFilterWorker(): Promise<void> {
  await getBoss().createQueue(ADVISORY_QUEUE, { policy: "singleton" });
  await work<{ signalId: string }>(ADVISORY_QUEUE, async (jobs) => {
    for (const job of jobs) {
      await runAdvisoryFilter(job.data.signalId);
    }
  });
}
