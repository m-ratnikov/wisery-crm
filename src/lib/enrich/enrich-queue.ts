import "server-only";
import { enqueue, enqueueInTx, getBoss, work } from "@/lib/jobs";
import type { DbTx } from "@/lib/db";
import { logger } from "@/lib/log";
import { enrichProspect } from "@/lib/enrich/pipeline";

// One enrich job per prospect. Triggered manually (single), in a batch (grid multi-select),
// or by the auto-enrich routing - all from the composition root, so enrichment never
// imports the next stage (the re-draft is wired via the worker's enqueueNext). Enrichment D-E.
const ENRICH_QUEUE = "enrich";

// User-triggered (fire-and-forget) enrich enqueue: the prospect-list single "Enrich" action.
export async function enqueueEnrich(prospectId: string): Promise<string | null> {
  return enqueue(ENRICH_QUEUE, { prospectId }, { singletonKey: prospectId });
}

// Batch user-triggered enrich (grid multi-select). Resilient per id: a single enqueue
// failure must not drop the rest (these are post-commit, user-initiated enqueues).
export async function enqueueEnrichForProspects(prospectIds: string[]): Promise<void> {
  for (const id of prospectIds) {
    try {
      await enqueueEnrich(id);
    } catch (err) {
      logger.error({ err, prospectId: id }, "failed to enqueue enrichment for prospect");
    }
  }
}

// Pipeline handoff: enqueue enrich ON the caller's transaction (the qualify prospect-write tx
// when auto-enrich is on), so the prospect and its enrich job commit atomically (ADR-0009).
export async function enqueueEnrichInTx(tx: DbTx, prospectId: string): Promise<string | null> {
  return enqueueInTx(tx, ENRICH_QUEUE, { prospectId }, { singletonKey: prospectId });
}

// The re-draft handoff is injected at the composition root as a transaction-aware callback,
// not imported here, so enrichment never imports drafting. enrichProspect calls it inside the
// dossier-upsert transaction when (and only when) it actually upserts a dossier.
export interface EnrichWorkerOptions {
  enqueueNext?: (tx: DbTx, prospectId: string) => Promise<void>;
}

export async function registerEnrichWorker(options: EnrichWorkerOptions = {}): Promise<void> {
  await getBoss().createQueue(ENRICH_QUEUE, { policy: "singleton" });
  await work<{ prospectId: string }>(ENRICH_QUEUE, async (jobs) => {
    for (const job of jobs) {
      await enrichProspect(job.data.prospectId, { enqueueNext: options.enqueueNext });
    }
  });
}
