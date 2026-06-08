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

// A person's content item as the provider yields it (engagement-posts, ADR-0018). `providerPostId`
// is the provider's stable post/activity id when it has one; otherwise the core canonicalizes
// `externalUrl` for the dedup key. An item with no stable identifier is dropped, never fabricated.
export interface RawPost {
  providerPostId?: string | null;
  externalUrl: string;
  content: string;
  postedAt?: Date | null;
}

export interface EnrichmentProvider {
  readonly name: string;
  enrich(subject: PersonSubject): Promise<EnrichmentResult>;
  // Fetch a person's recent posts. A new method on the existing port (ADR-0018), distinct from the
  // deep-profile `enrich` above - same scraping/enrichment seam (D4), not a new port.
  fetchPosts(subject: PersonSubject): Promise<RawPost[]>;
}

export class EnrichmentProviderError extends Error {
  readonly kind = "enrichment_provider" as const;
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "EnrichmentProviderError";
  }
}
