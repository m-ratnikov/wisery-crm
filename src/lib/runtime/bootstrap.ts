import "server-only";
import { getConfig } from "@/lib/config/env";
import { startJobs, stopJobs } from "@/lib/jobs";
import { logger } from "@/lib/log";
import { enqueueDraftInTx, registerDraftWorker } from "@/lib/draft/draft-queue";
import { enqueueEnrichInTx, registerEnrichWorker } from "@/lib/enrich/enrich-queue";
import { getSettings } from "@/lib/enrich/settings";
import { enqueueQualifyInTx, registerQualifyWorker } from "@/lib/qualify/qualify-queue";
import { registerScanWorker } from "@/lib/signals/scan-queue";

// Node-only runtime bootstrap. Kept out of instrumentation.ts so that nothing
// Node-specific (process.exit/once, pg-boss) is statically reachable from the
// Edge compile - instrumentation.ts imports this only in the Node.js runtime.
export async function bootstrapNodeRuntime(): Promise<void> {
  getConfig(); // fail fast on invalid configuration before starting anything
  await startJobs();
  // Register the pipeline workers and wire each stage's enqueue-on-completion hook here at
  // the composition root, so the jobs facade stays generic and no stage imports the next
  // (D-K, D-G): scan -> qualify -> draft (default), with enrich -> re-draft as an additive
  // side-transition when auto-enrich is on (ADR-0007).
  await registerDraftWorker();
  await registerEnrichWorker({
    // After enrichment, re-draft (forced) so the message is grounded in the dossier (ADR-0007),
    // enqueued INSIDE the dossier-upsert transaction so the re-draft commits with the dossier
    // or not at all (ADR-0009) - no enriched-but-undrafted strand.
    enqueueNext: async (tx, prospectId) => {
      await enqueueDraftInTx(tx, prospectId, true);
    },
  });
  await registerQualifyWorker({
    // Read the auto-enrich routing flag BEFORE the qualify transaction opens (outside it, so
    // the tx stays write-only and never waits on a second pooled connection, ADR-0009), then
    // return the in-tx handoff. Always draft from the signal so the prospect reaches the queue
    // - the default Qualified -> Drafted path (ADR-0007). Enrichment is an ADDITIVE side-
    // transition: when the opt-in setting is on, also enqueue it, and a successful enrich
    // force-re-drafts from the dossier (the enrich worker's enqueueNext). Both enqueues are on
    // the qualify transaction, so the prospect and its handoff jobs commit together - a
    // qualified prospect is never stranded without its handoff.
    resolveHandoff: async () => {
      const { autoEnrich } = await getSettings();
      return async (tx, ids) => {
        for (const id of ids) await enqueueDraftInTx(tx, id, false);
        if (autoEnrich) for (const id of ids) await enqueueEnrichInTx(tx, id);
      };
    },
  });
  await registerScanWorker({
    // Enqueue qualify INSIDE the signal-insert transaction (ADR-0009): a newly persisted
    // signal and its qualify job commit together, so a committed signal is never un-qualified.
    enqueueNext: async (tx, signalId) => {
      await enqueueQualifyInTx(tx, signalId);
    },
  });

  // Graceful drain is best-effort - Next may process.exit() before this finishes,
  // so job idempotency is the primary durability guarantee (ADR-0001).
  const shutdown = (signal: NodeJS.Signals) => {
    void (async () => {
      logger.info({ signal }, "shutdown: draining background jobs");
      try {
        await stopJobs();
      } catch (err) {
        logger.error({ err }, "error draining jobs on shutdown");
      } finally {
        process.exit(0);
      }
    })();
  };
  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);
}
