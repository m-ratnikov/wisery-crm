import "server-only";
import type { DbTx } from "@/lib/db";
import { getConfig } from "@/lib/config/env";
import { startJobs, stopJobs } from "@/lib/jobs";
import { logger } from "@/lib/log";
import { enqueueDraftInTx, registerDraftWorker } from "@/lib/draft/draft-queue";
import { enqueueEnrichInTx, registerEnrichWorker } from "@/lib/enrich/enrich-queue";
import { getSettings } from "@/lib/enrich/settings";
import {
  enqueueQualifyInTx,
  registerQualifyProspectWorker,
  registerQualifyWorker,
} from "@/lib/qualify/qualify-queue";
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
  // Read the auto-enrich routing flag BEFORE the qualify transaction opens (outside it, so
  // the tx stays write-only and never waits on a second pooled connection, ADR-0009), then
  // return the in-tx handoff. Always draft so the prospect reaches the queue - the default
  // Qualified -> Drafted path (ADR-0007). Enrichment is an ADDITIVE side-transition: when the
  // opt-in setting is on, also enqueue it, and a successful enrich force-re-drafts from the
  // dossier (the enrich worker's enqueueNext). Both enqueues are on the qualify transaction,
  // so the prospect and its handoff jobs commit together - never stranded without its handoff.
  // Shared by both qualify entries (signal-keyed and prospect-keyed for manual leads, ADR-0010).
  const resolveQualifyHandoff = async () => {
    const { autoEnrich } = await getSettings();
    return async (tx: DbTx, ids: string[]) => {
      for (const id of ids) await enqueueDraftInTx(tx, id, false);
      if (autoEnrich) for (const id of ids) await enqueueEnrichInTx(tx, id);
    };
  };
  await registerQualifyWorker({ resolveHandoff: resolveQualifyHandoff });
  await registerQualifyProspectWorker({ resolveHandoff: resolveQualifyHandoff });
  await registerScanWorker({
    // Route the persisted-signal handoff BY KIND (linkedin-jobs-source): only a person signal
    // enqueues qualify (which scores a person), INSIDE the signal-insert transaction (ADR-0009)
    // so the signal and its qualify job commit together. A non-person signal (company/content/
    // job) is persisted with no handoff - it awaits the normalize-expand stage (M2) that turns
    // it into person prospects; logged so the deferral is observable, not silent.
    enqueueNext: async (tx, signalId, kind) => {
      if (kind === "person") {
        await enqueueQualifyInTx(tx, signalId);
      } else {
        logger.info(
          { signalId, kind },
          "signal persisted without qualify handoff (awaits normalize-expand)",
        );
      }
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
