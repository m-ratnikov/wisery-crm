import "server-only";
import { getDb, type DbTx } from "@/lib/db";
import { dossiers } from "@/lib/db/schema";
import { getEnrichmentProvider } from "@/lib/enrich";
import type { EnrichmentProvider } from "@/lib/enrich/provider";
import { loadActionableProspect } from "@/lib/prospect/load";

// The testable enrich core (enrichment D-D): deep-enrich a qualified prospect (the qualification
// read, ADR-0019/0020) and upsert its single dossier. The provider is injectable so tests use the
// fake. The drafting stage was retired (ADR-0019), so the enqueueNext hook is currently unwired.
export interface EnrichOutcome {
  personId: string;
  enriched: boolean;
  skipped: boolean;
}

export async function enrichProspect(
  personId: string,
  opts: {
    provider?: EnrichmentProvider;
    // A generic post-dossier handoff on the SAME transaction as the dossier upsert (ADR-0009).
    // Currently unwired (the re-draft it once fed was retired with the drafting stage, ADR-0019);
    // kept as the seam a future dossier-triggered action would use. Absent in direct/test calls.
    enqueueNext?: (tx: DbTx, personId: string) => Promise<void>;
  } = {},
): Promise<EnrichOutcome> {
  const db = getDb();

  // Only a qualified prospect is enriched (the qualification read); below-bar / unassessed skip.
  const loaded = await loadActionableProspect(personId);
  if (!loaded) {
    return { personId, enriched: false, skipped: true };
  }
  const { subject } = loaded;

  const provider = opts.provider ?? getEnrichmentProvider();
  const result = await provider.enrich(subject);

  // Upsert the single dossier (one per prospect): re-enrich updates it, never duplicates.
  // Any handoff commits with the dossier or not at all (ADR-0009).
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
