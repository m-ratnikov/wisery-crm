import "server-only";
import { getConfig } from "@/lib/config/env";
import { deleteQueue, startJobs, stopJobs } from "@/lib/jobs";
import { logger } from "@/lib/log";
import { registerEnrichWorker } from "@/lib/enrich/enrich-queue";
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
  // Register the pipeline workers here at the composition root, so the jobs facade stays generic
  // and no stage imports the next (D-K, D-G): scan -> advisory -> (human triage approval). Scoring
  // and message generation are now synchronous on-demand Person actions, not pipeline stages
  // (ADR-0019), so there is no qualify or draft worker and no post-approval handoff to wire.
  await registerEnrichWorker();
  // Universal triage (ADR-0013): the advisory filter runs once per persisted signal; triage approval
  // (a Server Action) creates the routed entity and promotes the advisory score synchronously
  // (ADR-0019). The advisory filter has no pipeline handoff (it writes a hint), so no enqueueNext wiring.
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

  // One-time cleanup of the queues orphaned by retiring the drafting and qualify-prospect workers
  // (ADR-0019): nothing registers them now, so their pg-boss rows would linger. deleteQueue swallows
  // a missing-queue error, so this is idempotent across reboots and never crashes bootstrap.
  await deleteQueue("draft");
  await deleteQueue("qualify-prospect");

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
