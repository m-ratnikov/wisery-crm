import "server-only";
import type { PersonSubject } from "@/lib/prospect/identity";

// The EnrichmentProvider port (D4, ADR-0002): deep-enrich a prospect into a research bundle.
// Takes a PersonSubject ({kind, payload}) so it serves a discovered prospect (its signal,
// which satisfies the shape) and a manual one (synthesized from its columns) the same way
// (ADR-0010). Provider-neutral - Apify (managed, default) and a self-host adapter are
// interchangeable. The bundle is opaque (stored as JSONB, not interpreted here).
export interface EnrichmentResult {
  data: unknown;
  provider: string;
}

export interface EnrichmentProvider {
  readonly name: string;
  enrich(subject: PersonSubject): Promise<EnrichmentResult>;
}

export class EnrichmentProviderError extends Error {
  readonly kind = "enrichment_provider" as const;
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "EnrichmentProviderError";
  }
}
