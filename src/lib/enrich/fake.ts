import "server-only";
import type { EnrichmentProvider, EnrichmentResult, RawPost } from "@/lib/enrich/provider";
import type { PersonSubject } from "@/lib/prospect/identity";

// A deterministic, no-network enrichment provider so the pipeline and its consumers are
// testable offline (the LLM-fake pattern). The handler returns the bundle for a subject; the
// optional postsHandler returns the person's posts (engagement-posts), defaulting to none.
export function createFakeEnrichment(
  handler: (subject: PersonSubject) => unknown,
  postsHandler?: (subject: PersonSubject) => RawPost[],
): EnrichmentProvider {
  return {
    name: "fake",
    enrich(subject: PersonSubject): Promise<EnrichmentResult> {
      return Promise.resolve({ data: handler(subject), provider: "fake" });
    },
    fetchPosts(subject: PersonSubject): Promise<RawPost[]> {
      return Promise.resolve(postsHandler ? postsHandler(subject) : []);
    },
  };
}
