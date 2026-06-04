import type { Metadata } from "next";
import { getSettings } from "@/lib/enrich/settings";
import { listProspects } from "@/lib/prospect/read";
import { ProspectGrid, type GridItem } from "./_components/ProspectGrid";

// Anchor view #3, wired (prospect-list): the browse/manage grid over every prospect, and the
// home of the manual/batch enrich trigger and the auto-enrich toggle (ADR-0007). A Server
// Component reading the read-model; mutations are Server Actions (see actions.ts).
//
// D1: authorization is deferred (single-user MVP); the actions are unauthenticated by design.

export const metadata: Metadata = {
  title: "Prospects - Wisery CRM",
};

export default async function ProspectListPage() {
  const [prospects, settings] = await Promise.all([listProspects(), getSettings()]);
  // enriched/drafted are derived facets (ADR-0008); pass a client-friendly shape (no Date).
  const items: GridItem[] = prospects.map((p) => ({
    id: p.id,
    name: p.name,
    status: p.status,
    origin: p.origin,
    score: p.score,
    summary: p.summary,
    sourceKind: p.sourceKind,
    enriched: p.enriched,
    drafted: p.drafted,
  }));

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      <div className="mx-auto w-full max-w-5xl px-8 py-10">
        <header className="mb-6">
          <h1 className="text-lg font-semibold tracking-tight">Prospects</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Every prospect across the pipeline. Filter, open a prospect, or trigger enrichment -
            single or a selected batch. Toggle auto-enrich to enrich on qualification.
          </p>
        </header>
        <ProspectGrid items={items} autoEnrich={settings.autoEnrich} />
      </div>
    </div>
  );
}
