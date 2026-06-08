import "server-only";
import type { DbTx } from "@/lib/db";
import { getConfig } from "@/lib/config/env";
import { startJobs, stopJobs } from "@/lib/jobs";
import { logger } from "@/lib/log";
import { enqueueDraftInTx, registerDraftWorker } from "@/lib/draft/draft-queue";
import { enqueueEnrichInTx, registerEnrichWorker } from "@/lib/enrich/enrich-queue";
import { getSettings } from "@/lib/enrich/settings";
import { registerQualifyProspectWorker } from "@/lib/qualify/qualify-queue";
import { registerScanWorker } from "@/lib/signals/scan-queue";
import { registerActivityScan, registerFetchPostsWorker } from "@/lib/posts/posts-queue";
import {
  enqueueAdvisoryFilterInTx,
  registerAdvisoryFilterWorker,
} from "@/lib/triage/advisory-queue";

// Node-only runtime bootstrap. Kept out of instrumentation.ts so that nothing
// Node-specific (process.exit/once, pg-boss) is statically reachable from the
// Edge compile - instrumentation.ts imports this only in the Node.js runtime.
export async function bootstrapNodeRuntime(): Promise<void> {
  getConfig(); // fail fast on invalid configuration before starting anything
  await startJobs();
  // Register the pipeline workers and wire each stage's enqueue-on-completion hook here at
  // the composition root, so the jobs facade stays generic and no stage imports the next
  // (D-K, D-G): scan -> advisory -> (human triage approval) -> qualify -> draft (ADR-0013),
  // with enrich -> re-draft as an additive side-transition when auto-enrich is on (ADR-0007).
  await registerDraftWorker();
  await registerEnrichWorker({
    // After enrichment, re-draft (forced) so the message is grounded in the dossier (ADR-0007),
    // enqueued INSIDE the dossier-upsert transaction so the re-draft commits with the dossier
    // or not at all (ADR-0009) - no enriched-but-undrafted strand.
    enqueueNext: async (tx, personId) => {
      await enqueueDraftInTx(tx, personId, true);
    },
  });
  // Read the auto-enrich routing flag BEFORE the qualify transaction opens (outside it, so
  // the tx stays write-only and never waits on a second pooled connection, ADR-0009), then
  // return the in-tx handoff. Always draft so the prospect reaches the queue - the default
  // Qualified -> Drafted path (ADR-0007). Enrichment is an ADDITIVE side-transition: when the
  // opt-in setting is on, also enqueue it, and a successful enrich force-re-drafts from the
  // dossier (the enrich worker's enqueueNext). Both enqueues are on the qualify transaction,
  // so the prospect and its handoff jobs commit together - never stranded without its handoff.
  // Used by the prospect-keyed qualify worker (manual leads + triage-approved prospects, ADR-0010/0013).
  const resolveQualifyHandoff = async () => {
    const { autoEnrich } = await getSettings();
    return async (tx: DbTx, ids: string[]) => {
      for (const id of ids) await enqueueDraftInTx(tx, id, false);
      if (autoEnrich) for (const id of ids) await enqueueEnrichInTx(tx, id);
    };
  };
  // The signal-keyed qualify worker is intentionally NOT registered: under universal triage
  // (ADR-0013) a signal never auto-creates a prospect, so nothing enqueues the `qualify` queue.
  // Qualify is enqueued only at triage approval (prospect-keyed). qualifySignal survives as a
  // test-only helper; a fitness function forbids any production import of enqueueQualifyInTx.
  await registerQualifyProspectWorker({ resolveHandoff: resolveQualifyHandoff });
  // Universal triage (ADR-0013): the advisory filter runs once per persisted signal; triage approval
  // (a Server Action) creates the routed entity and enqueues qualify. The advisory filter has no
  // pipeline handoff (it writes a hint), so no enqueueNext wiring.
  await registerAdvisoryFilterWorker();
  await registerScanWorker({
    // Universal triage (ADR-0013): every persisted signal is enqueued for the advisory filter and
    // then awaits a human approve/dismiss - NO auto-fan-out to a prospect, no per-source bypass.
    // The advisory enqueue rides the signal-insert transaction (ADR-0009), executed off-tx later.
    enqueueNext: async (tx, signalId) => {
      await enqueueAdvisoryFilterInTx(tx, signalId);
    },
  });

  // Engagement (engagement-posts, ADR-0018): the fetch-posts worker serves the user-triggered "get
  // latest posts" action and the activity scan; the activity scan is a cron dispatcher that enqueues
  // one fetch-posts job per monitored person (per-unit isolation, D-K). No pipeline handoff (posts
  // are a leaf), so no enqueueNext wiring.
  await registerFetchPostsWorker();
  await registerActivityScan();

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
