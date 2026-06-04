import "server-only";
import { eq } from "drizzle-orm";
import { getDb, type DbTx } from "@/lib/db";
import { scans, signals, sources } from "@/lib/db/schema";
import { rawItemSchema } from "@/lib/signals/connector";
import { getConnector } from "@/lib/signals/registry";

// The testable orchestration core (D-I): load the source, open a scan run, consume the
// connector, validate-dedup-persist each item, tally counts, close the run. Depends on
// the data layer only; it is driven directly by tests and wrapped by the scan queue.
export interface ScanResult {
  scanId: string;
  status: "completed" | "failed";
  fetched: number;
  persisted: number;
  dropped: number;
  error?: string;
  // The ids of signals newly persisted by this scan (not dedup duplicates). The scan
  // worker hands these to the enqueue-on-persist hook so only new signals are qualified.
  persistedSignalIds: string[];
}

interface Counts {
  fetched: number;
  persisted: number;
  dropped: number;
}

// Single representation of closing a scan run, so the completed and failed paths can
// never drift in which fields they record (error stays null on the completed path).
async function closeScan(
  scanId: string,
  outcome: { status: "completed" | "failed"; error?: string },
  counts: Counts,
): Promise<void> {
  await getDb()
    .update(scans)
    .set({
      status: outcome.status,
      error: outcome.error,
      finishedAt: new Date(),
      fetchedCount: counts.fetched,
      persistedCount: counts.persisted,
      droppedCount: counts.dropped,
    })
    .where(eq(scans.id, scanId));
}

export async function runScan(
  sourceId: string,
  // Enqueue the next stage for a NEWLY persisted signal on the SAME transaction as its insert
  // (ADR-0009), so a committed signal can never be stranded without its handoff. The signal's
  // `kind` is passed so the composition root routes by it: only a person enqueues qualify; a
  // non-person kind (company/content/job) is persisted but awaits normalize-expand
  // (linkedin-jobs-source). Injected by the worker; absent in direct/test calls. Dedup
  // duplicates never hand off.
  opts: { enqueueNext?: (tx: DbTx, signalId: string, kind: string) => Promise<void> } = {},
): Promise<ScanResult> {
  const db = getDb();

  const [source] = await db.select().from(sources).where(eq(sources.id, sourceId)).limit(1);
  if (!source) {
    throw new Error(`source ${sourceId} not found`);
  }

  const [scan] = await db.insert(scans).values({ sourceId }).returning({ id: scans.id });
  const scanId = scan.id;

  const counts: Counts = { fetched: 0, persisted: 0, dropped: 0 };
  const persistedSignalIds: string[] = [];

  try {
    const connector = getConnector(source.kind);
    for await (const item of connector.scan(source)) {
      counts.fetched++;
      const parsed = rawItemSchema.safeParse(item);
      if (!parsed.success) {
        // Edge-validation drop: a malformed item (bad kind, blank/absent dedupKey, or
        // absent payload - rawItemSchema's fields are all required) never lands as a
        // fact and never crashes the scan; it is counted dropped (D-J).
        counts.dropped++;
        continue;
      }
      // Persist the signal and hand it off to qualify in one transaction: a dedup miss
      // inserts the fact and enqueues its qualify job atomically; a dedup hit inserts
      // nothing and hands off nothing (ADR-0009).
      const newSignalId = await db.transaction(async (tx) => {
        const inserted = await tx
          .insert(signals)
          .values({
            sourceId,
            scanId,
            kind: parsed.data.kind,
            dedupKey: parsed.data.dedupKey,
            payload: parsed.data.payload,
          })
          .onConflictDoNothing({ target: [signals.sourceId, signals.dedupKey] })
          .returning({ id: signals.id });
        if (inserted.length === 0) return null;
        if (opts.enqueueNext) await opts.enqueueNext(tx, inserted[0].id, parsed.data.kind);
        return inserted[0].id;
      });
      if (newSignalId) {
        counts.persisted++;
        persistedSignalIds.push(newSignalId);
      } else {
        counts.dropped++; // per-source dedup drop: already persisted (D-B)
      }
    }
    await closeScan(scanId, { status: "completed" }, counts);
    return { scanId, status: "completed", ...counts, persistedSignalIds };
  } catch (err) {
    // One source's failure is isolated: record it on this scan and return, never throw
    // out of runScan, so a sibling source's scan is unaffected (D-D, spec isolation).
    const message = err instanceof Error ? err.message : String(err);
    await closeScan(scanId, { status: "failed", error: message }, counts);
    return { scanId, status: "failed", ...counts, error: message, persistedSignalIds };
  }
}
