import "server-only";
import { enqueue, enqueueInTx, getBoss, work } from "@/lib/jobs";
import type { DbTx } from "@/lib/db";
import { logger } from "@/lib/log";
import { enrichProspect } from "@/lib/enrich/pipeline";

// One enrich job per prospect. Triggered manually (single) or in a batch (grid multi-select).
// Wired from the composition root, so enrichment never imports the next stage. Enrichment D-E.
const ENRICH_QUEUE = "enrich";

// User-triggered (fire-and-forget) enrich enqueue: the prospect-list single "Enrich" action.
export async function enqueueEnrich(personId: string): Promise<string | null> {
  return enqueue(ENRICH_QUEUE, { personId }, { singletonKey: personId });
}

// Batch user-triggered enrich (grid multi-select). Resilient per id: a single enqueue
// failure must not drop the rest (these are post-commit, user-initiated enqueues).
export async function enqueueEnrichForProspects(prospectIds: string[]): Promise<void> {
  for (const id of prospectIds) {
    try {
      await enqueueEnrich(id);
    } catch (err) {
      logger.error({ err, personId: id }, "failed to enqueue enrichment for prospect");
    }
  }
}

// Transaction-aware enqueue seam: enqueue enrich ON the caller's transaction so the entity write
// and its enrich job commit atomically (ADR-0009). Intentionally retained with no caller today -
// it is the seam a future auto-enrich-on-approval would call from the approval transaction (the
// qualify-time auto-enrich path it once served is gone, ADR-0019/0022).
export async function enqueueEnrichInTx(tx: DbTx, personId: string): Promise<string | null> {
  return enqueueInTx(tx, ENRICH_QUEUE, { personId }, { singletonKey: personId });
}

// The re-draft handoff is injected at the composition root as a transaction-aware callback,
// not imported here, so enrichment never imports drafting. enrichProspect calls it inside the
// dossier-upsert transaction when (and only when) it actually upserts a dossier.
export interface EnrichWorkerOptions {
  enqueueNext?: (tx: DbTx, personId: string) => Promise<void>;
}

export async function registerEnrichWorker(options: EnrichWorkerOptions = {}): Promise<void> {
  await getBoss().createQueue(ENRICH_QUEUE, { policy: "singleton" });
  await work<{ personId: string }>(ENRICH_QUEUE, async (jobs) => {
    for (const job of jobs) {
      await enrichProspect(job.data.personId, { enqueueNext: options.enqueueNext });
    }
  });
}
