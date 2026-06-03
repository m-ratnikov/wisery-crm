import "server-only";
import type { EnrichmentProvider, EnrichmentResult } from "@/lib/enrich/provider";
import type { SignalRow } from "@/lib/signals/connector";

// A deterministic, no-network enrichment provider so the pipeline and its consumers are
// testable offline (the LLM-fake pattern). The handler returns the bundle for a signal.
export function createFakeEnrichment(handler: (signal: SignalRow) => unknown): EnrichmentProvider {
  return {
    name: "fake",
    enrich(signal: SignalRow): Promise<EnrichmentResult> {
      return Promise.resolve({ data: handler(signal), provider: "fake" });
    },
  };
}
