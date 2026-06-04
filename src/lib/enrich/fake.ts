import "server-only";
import type { EnrichmentProvider, EnrichmentResult } from "@/lib/enrich/provider";
import type { PersonSubject } from "@/lib/prospect/identity";

// A deterministic, no-network enrichment provider so the pipeline and its consumers are
// testable offline (the LLM-fake pattern). The handler returns the bundle for a subject.
export function createFakeEnrichment(
  handler: (subject: PersonSubject) => unknown,
): EnrichmentProvider {
  return {
    name: "fake",
    enrich(subject: PersonSubject): Promise<EnrichmentResult> {
      return Promise.resolve({ data: handler(subject), provider: "fake" });
    },
  };
}
