import "server-only";
import type { SignalRow } from "@/lib/signals/connector";

// The EnrichmentProvider port (D4, ADR-0002): deep-enrich a prospect's signal into a
// research bundle. Provider-neutral - Apify (managed, default) and a self-host adapter are
// interchangeable. The bundle is opaque (stored as JSONB, not interpreted here).
export interface EnrichmentResult {
  data: unknown;
  provider: string;
}

export interface EnrichmentProvider {
  readonly name: string;
  enrich(signal: SignalRow): Promise<EnrichmentResult>;
}

export class EnrichmentProviderError extends Error {
  readonly kind = "enrichment_provider" as const;
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "EnrichmentProviderError";
  }
}
