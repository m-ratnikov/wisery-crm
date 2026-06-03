import "server-only";
import { createApifyEnrichment } from "@/lib/enrich/apify";
import type { EnrichmentProvider } from "@/lib/enrich/provider";

// The composition point: the only module that wires the default concrete adapter (D-C).
// Callers depend on the EnrichmentProvider port and obtain the default via
// getEnrichmentProvider(); consumers that swap it under test take a provider parameter
// defaulting to this and pass createFakeEnrichment(...).
let defaultProvider: EnrichmentProvider | undefined;

export function getEnrichmentProvider(): EnrichmentProvider {
  if (!defaultProvider) defaultProvider = createApifyEnrichment();
  return defaultProvider;
}

export type { EnrichmentProvider, EnrichmentResult } from "@/lib/enrich/provider";
export { EnrichmentProviderError } from "@/lib/enrich/provider";
