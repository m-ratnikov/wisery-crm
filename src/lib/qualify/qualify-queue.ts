import "server-only";
import { enqueueInTx, getBoss, work } from "@/lib/jobs";
import type { DbTx } from "@/lib/db";
import { qualifySignal } from "@/lib/qualify/pipeline";

// One qualify job per signal, over the generic jobs facade (mirrors the scan worker). The
// enqueue-on-persist wiring lives at the composition root (bootstrap), so signal-ingestion
// never imports this module - dependency direction stays qualify -> signals (D-G).
const QUALIFY_QUEUE = "qualify";

// Enqueue qualification for a signal ON the caller's transaction - the scan's signal-insert
// transaction - so a newly persisted signal and its qualify job commit atomically (ADR-0009).
// The queue's `singleton` policy + `singletonKey` keep at most one active qualify job per
// signal; combined with the prospect-exists guard in qualifySignal, a duplicate or concurrent
// enqueue yields one prospect and one LLM call - without a DB unique on signal_id (ADR-0005).
export async function enqueueQualifyInTx(tx: DbTx, signalId: string): Promise<string | null> {
  return enqueueInTx(tx, QUALIFY_QUEUE, { signalId }, { singletonKey: signalId });
}

// The downstream handoff (enqueue drafting for qualified prospects, + enrichment when auto) is
// injected at the composition root as a transaction-aware callback, not imported here, so
// qualification never depends on drafting - the same seam as scan -> qualify (drafting D-E).
// `resolveHandoff` runs BEFORE qualifySignal opens its transaction, so any I/O the routing
// decision needs (reading the auto-enrich setting) happens outside the tx; the callback it
// returns does only enqueues, on the tx, keeping the transaction write-only (ADR-0009).
export interface QualifyWorkerOptions {
  resolveHandoff?: () => Promise<(tx: DbTx, qualifiedProspectIds: string[]) => Promise<void>>;
}

export async function registerQualifyWorker(options: QualifyWorkerOptions = {}): Promise<void> {
  // `singleton` policy makes `singletonKey` enforce one active qualify job per signal.
  await getBoss().createQueue(QUALIFY_QUEUE, { policy: "singleton" });
  await work<{ signalId: string }>(QUALIFY_QUEUE, async (jobs) => {
    // Let a handler error propagate so pg-boss retries a transient failure and dead-letters
    // genuine poison (ADR-0001 durability). At the default batchSize=1 there is no sibling
    // batch to isolate; a swallowing catch here would only suppress that retry.
    for (const job of jobs) {
      const enqueueNext = options.resolveHandoff ? await options.resolveHandoff() : undefined;
      await qualifySignal(job.data.signalId, { enqueueNext });
    }
  });
}
