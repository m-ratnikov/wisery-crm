import type {
  ScanHistorySnapshot,
  ScanRunStatus,
  ScanRunView,
} from "@/lib/signals/scan-history-view";

// The pure, testable half of the scan-run-history read-model (ADR-0012): it maps a scan row
// (joined to its source) to the plain-language ScanRunView the monitor renders. No I/O - the
// Drizzle read lives in ./scan-history. Mirrors activity-map.ts (the jobs read-model's pure
// half). The ISO/error helpers from activity-map are intentionally NOT imported here: that would
// create a runtime signals -> jobs edge, and with only a second caller the rule of three says
// inline rather than extract a shared module.

// The fields the mapper needs from a scan joined to its source. The reader (./scan-history)
// selects exactly these columns; keeping the shape here lets the mapper stay DB-free and
// unit-tested.
export interface ScanRunRow {
  id: string;
  status: ScanRunStatus;
  startedAt: Date;
  finishedAt: Date | null;
  fetchedCount: number;
  persistedCount: number;
  droppedCount: number;
  error: string | null;
  sourceKind: string;
  sourceConfig: Record<string, unknown> | null;
}

// The source's display name (its user-entered config.name) falling back to its kind - the same
// convention the source list renders (SourcesPanel: `s.name || s.kind`).
export function sourceLabel(kind: string, config: Record<string, unknown> | null): string {
  const name = config?.name;
  return typeof name === "string" && name.trim() !== "" ? name.trim() : kind;
}

// Plain-language outcome from a run's status and counts (design D4). Kept in one place so the
// spec scenarios map one-to-one to test cases. "already seen" is inferred from a drop with no
// new signal; droppedCount merges dedup- and validation-drops, so this is the common case, not
// a precise per-reason guarantee (design Non-Goals).
export function summarize(
  status: ScanRunStatus,
  counts: { fetched: number; persisted: number; dropped: number },
  error: string | null,
): string {
  if (status === "failed") return error?.trim() ? error.trim() : "failed";
  if (status === "running") return "in progress";
  const { fetched, persisted, dropped } = counts;
  if (fetched === 0) return "nothing matched";
  if (persisted > 0) {
    const seen = dropped > 0 ? `, ${dropped} already seen` : "";
    return `fetched ${fetched}, ${persisted} new${seen}`;
  }
  return `fetched ${fetched}, no new signals, all already seen`;
}

export function mapScanRun(row: ScanRunRow): ScanRunView {
  const counts = {
    fetched: row.fetchedCount,
    persisted: row.persistedCount,
    dropped: row.droppedCount,
  };
  return {
    id: row.id,
    sourceLabel: sourceLabel(row.sourceKind, row.sourceConfig),
    status: row.status,
    startedOn: row.startedAt.toISOString(),
    finishedOn: row.finishedAt ? row.finishedAt.toISOString() : null,
    summary: summarize(row.status, counts, row.error),
    ...counts,
  };
}

export function assembleScanHistory(rows: ScanRunRow[]): ScanHistorySnapshot {
  return { status: "ok", runs: rows.map(mapScanRun) };
}

// Degrade a read failure to a structured unavailable result, mirroring the jobs read-model's
// unavailable() (inlined per the rule-of-three note above).
export function scanHistoryUnavailable(err: unknown): ScanHistorySnapshot {
  const reason = err instanceof Error ? err.message : "scan history unavailable";
  return { status: "unavailable", reason };
}
