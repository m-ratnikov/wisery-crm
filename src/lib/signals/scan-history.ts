import "server-only";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { scans, sources } from "@/lib/db/schema";
import { logger } from "@/lib/log";
import {
  assembleScanHistory,
  scanHistoryUnavailable,
  type ScanRunRow,
} from "@/lib/signals/scan-history-map";
import type { ScanHistorySnapshot } from "@/lib/signals/scan-history-view";

// Read-only scan-run-history (ADR-0012): a domain read-model surfaced on the jobs monitor page
// ALONGSIDE the pg-boss introspection, not folded into the pg-boss facade. It is an ordinary
// web-tier Drizzle read (not getWipData), so unlike the liveness line it stays correct after a
// web/worker peel. The thin I/O half; the pure row -> DTO mapping lives in ./scan-history-map.

// Bound the rows read and transmitted: most-recent-first, so the page and query stay responsive
// as scan history grows (the view shows recent runs, not the whole history).
const DEFAULT_LIMIT = 20;

export async function listScanHistory(limit = DEFAULT_LIMIT): Promise<ScanHistorySnapshot> {
  try {
    const rows: ScanRunRow[] = await getDb()
      .select({
        id: scans.id,
        status: scans.status,
        startedAt: scans.startedAt,
        finishedAt: scans.finishedAt,
        fetchedCount: scans.fetchedCount,
        persistedCount: scans.persistedCount,
        droppedCount: scans.droppedCount,
        error: scans.error,
        sourceKind: sources.kind,
        sourceConfig: sources.config,
      })
      .from(scans)
      .innerJoin(sources, eq(scans.sourceId, sources.id))
      .orderBy(desc(scans.startedAt))
      .limit(limit);
    return assembleScanHistory(rows);
  } catch (err) {
    // A DB read failure degrades to a structured unavailable result (logged), so the scan-history
    // section can render its own unavailable state without blanking the rest of the monitor.
    logger.warn({ err }, "scan history unavailable");
    return scanHistoryUnavailable(err);
  }
}
