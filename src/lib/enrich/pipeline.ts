import "server-only";
import { getDb, type DbTx } from "@/lib/db";
import { dossiers } from "@/lib/db/schema";
import { getEnrichmentProvider } from "@/lib/enrich";
import type { EnrichmentProvider } from "@/lib/enrich/provider";
import { loadActionableProspect } from "@/lib/prospect/load";

// The testable enrich core (enrichment D-D): deep-enrich a qualified/queued prospect and
// upsert its single dossier. The provider is injectable so tests use the fake. The
// re-draft is not called here (that would import drafting); the composition root wires it.
export interface EnrichOutcome {
  personId: string;
  enriched: boolean;
  skipped: boolean;
}

export async function enrichProspect(
  personId: string,
  opts: {
    provider?: EnrichmentProvider;
    // Enqueue the forced re-draft on the SAME transaction as the dossier upsert (ADR-0009),
    // so an enriched prospect can never be stranded without its dossier-grounded re-draft.
    // Injected by the worker; absent in direct/test calls.
    enqueueNext?: (tx: DbTx, personId: string) => Promise<void>;
  } = {},
): Promise<EnrichOutcome> {
  const db = getDb();

  // Only a qualified or queued prospect is enriched; a below-bar one never is (skip).
  const loaded = await loadActionableProspect(personId);
  if (!loaded) {
    return { personId, enriched: false, skipped: true };
  }
  const { subject } = loaded;

  const provider = opts.provider ?? getEnrichmentProvider();
  const result = await provider.enrich(subject);

  // Upsert the single dossier (one per prospect): re-enrich updates it, never duplicates.
  // The re-draft handoff commits with the dossier or not at all.
  await db.transaction(async (tx) => {
    await tx
      .insert(dossiers)
      .values({ personId, data: result.data, provider: result.provider })
      .onConflictDoUpdate({
        target: dossiers.personId,
        set: { data: result.data, provider: result.provider, enrichedAt: new Date() },
      });
    if (opts.enqueueNext) await opts.enqueueNext(tx, personId);
  });

  return { personId, enriched: true, skipped: false };
}
