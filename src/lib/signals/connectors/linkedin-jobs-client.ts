import "server-only";
import type { RawItem, SignalSource, SourceRow } from "@/lib/signals/connector";
import { type LinkedinJobRecord, normalizeJob } from "@/lib/signals/connectors/linkedin-jobs";
import { linkedinJobsConfigSchema } from "@/lib/signals/source-kind-schemas";

// The network half of the LinkedIn jobs connector (linkedin-jobs-source). Coverage-excluded:
// it needs real access to a LinkedIn jobs endpoint, exercised by a live smoke, not unit tests
// (the Apify/Anthropic-adapter posture). LinkedIn is a hardened target (D2/ADR-0002), so a real
// run goes via the provider or a self-host browser - this adapter is the seam; its access path
// is its implementation detail and is not yet wired to a concrete endpoint. The pure mapping
// (normalizeJob) and the config schema live in ./linkedin-jobs and ARE unit-tested.

async function fetchLinkedinJobs(keywords: string): Promise<LinkedinJobRecord[]> {
  await Promise.resolve();
  throw new Error(
    `linkedin-jobs: search "${keywords}" is not yet wired to a concrete LinkedIn jobs endpoint (provider/self-host browser per ADR-0002)`,
  );
}

export const linkedinJobsConnector: SignalSource = {
  kind: "linkedin-jobs",
  async *scan(source: SourceRow): AsyncIterable<RawItem> {
    const config = linkedinJobsConfigSchema.parse(source.config ?? {});
    const records = await fetchLinkedinJobs(config.keywords);
    for (const record of records) {
      yield normalizeJob(record);
    }
  },
};
