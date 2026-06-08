import "server-only";
import type { RawItem } from "@/lib/signals/connector";

// The pure, testable half of the LinkedIn jobs connector (linkedin-jobs-source): the record ->
// RawItem normalization. The network fetch lives in ./linkedin-jobs-client (coverage-excluded,
// like the Apify/Anthropic adapters); this module stays free of I/O so its mapping is
// unit-tested. The config schema lives in ../source-kind-schemas (shared with the catalog). A
// LinkedIn job posting becomes a `job`-kind signal; turning a job into person person is the
// deferred normalize-expand stage (M2).

// A normalized job posting from the client. The connector boundary owns the upstream shape;
// only `jobId` is load-bearing (the stable dedup key) - the rest is carried into the payload.
export interface LinkedinJobRecord {
  jobId: string;
  title?: string;
  company?: string;
  location?: string;
  url?: string;
  postedAt?: string;
}

// Map a posting to a `job`-kind RawItem with a stable per-source dedup key, so re-scanning the
// same posting dedups (signal-ingestion). Throws on a missing stable id - an unidentifiable
// posting cannot be deduped, so it is rejected at the edge rather than landing as a dup risk.
export function normalizeJob(record: LinkedinJobRecord): RawItem {
  if (!record.jobId) {
    throw new Error("linkedin-jobs: posting has no stable jobId; cannot build a dedup key");
  }
  return {
    kind: "job",
    dedupKey: `linkedin-job:${record.jobId}`,
    payload: {
      title: record.title ?? null,
      company: record.company ?? null,
      location: record.location ?? null,
      url: record.url ?? null,
      postedAt: record.postedAt ?? null,
    },
  };
}
