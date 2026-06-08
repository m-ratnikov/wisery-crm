import "server-only";
import { getConfig } from "@/lib/config/env";
import {
  type EnrichmentProvider,
  EnrichmentProviderError,
  type EnrichmentResult,
  type RawPost,
} from "@/lib/enrich/provider";
import type { PersonSubject } from "@/lib/prospect/identity";

// The default managed adapter (ADR-0002): Apify keeps detection/ban risk off the user's
// own account (D2). The concrete actor call lands when an actor id + APIFY_API_TOKEN are
// available; until then this adapter is structured but not wired, and tests use the fake.
// Its network call is the coverage-excluded seam (the Anthropic-adapter posture).
export function createApifyEnrichment(): EnrichmentProvider {
  return {
    name: "apify",
    enrich(subject: PersonSubject): Promise<EnrichmentResult> {
      const token = getConfig().apifyApiToken;
      if (!token) {
        return Promise.reject(
          new EnrichmentProviderError(
            "APIFY_API_TOKEN is not set; the Apify enrichment adapter cannot run",
          ),
        );
      }
      return Promise.reject(
        new EnrichmentProviderError(
          `Apify enrichment for subject kind "${subject.kind}" is not yet wired to a concrete actor`,
        ),
      );
    },
    fetchPosts(subject: PersonSubject): Promise<RawPost[]> {
      const token = getConfig().apifyApiToken;
      if (!token) {
        return Promise.reject(
          new EnrichmentProviderError(
            "APIFY_API_TOKEN is not set; the Apify posts adapter cannot run",
          ),
        );
      }
      return Promise.reject(
        new EnrichmentProviderError(
          `Apify post fetch for subject kind "${subject.kind}" is not yet wired to a concrete actor`,
        ),
      );
    },
  };
}
