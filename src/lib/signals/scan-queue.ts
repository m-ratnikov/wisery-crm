import "server-only";
import { enqueue, getBoss, work } from "@/lib/jobs";
import type { DbTx } from "@/lib/db";
import { runScan } from "@/lib/signals/pipeline";

// One pg-boss job per source for failure isolation and retry (D-K, ADR-0004). Thin
// wrappers over the generic jobs facade so the facade stays free of signal-specific
// knowledge; the worker is registered from the composition root after startJobs().
const SCAN_QUEUE = "source-scan";

export async function enqueueScan(sourceId: string): Promise<string | null> {
  return enqueue(SCAN_QUEUE, { sourceId });
}

// The downstream handoff is injected at the composition root (bootstrap) as a
// transaction-aware callback, not imported here, so signal-ingestion stays free of any
// qualification dependency. runScan calls it inside each newly persisted signal's insert
// transaction, so the signal and its qualify job commit atomically (ADR-0009, qualification
// D-G); a dedup duplicate inserts nothing and hands off nothing.
export interface ScanWorkerOptions {
  enqueueNext?: (tx: DbTx, signalId: string) => Promise<void>;
}

export async function registerScanWorker(options: ScanWorkerOptions = {}): Promise<void> {
  await getBoss().createQueue(SCAN_QUEUE);
  await work<{ sourceId: string }>(SCAN_QUEUE, async (jobs) => {
    // Let a handler error propagate so pg-boss retries a transient failure (e.g. a DB blip
    // before the scan run opens) and dead-letters genuine poison (ADR-0001 durability).
    // runScan already records connector failures itself as a failed scan; only precondition
    // errors escape it, and those should retry, not be silently swallowed.
    for (const job of jobs) {
      await runScan(job.data.sourceId, { enqueueNext: options.enqueueNext });
    }
  });
}
