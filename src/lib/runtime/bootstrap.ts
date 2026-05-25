import "server-only";
import { getConfig } from "@/lib/config/env";
import { startJobs, stopJobs } from "@/lib/jobs";
import { logger } from "@/lib/log";

// Node-only runtime bootstrap. Kept out of instrumentation.ts so that nothing
// Node-specific (process.exit/once, pg-boss) is statically reachable from the
// Edge compile - instrumentation.ts imports this only in the Node.js runtime.
export async function bootstrapNodeRuntime(): Promise<void> {
  getConfig(); // fail fast on invalid configuration before starting anything
  await startJobs();

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
