## Why

The product overview (section 4) and the domain-model lifecycle draw enrichment as an automatic, score-gated pipeline stage (`Qualified -> Enriched -> Drafted`). The locked product direction is different: **enrichment is user-triggered and optional by default** - invoked from a prospect's detail or by multi-selecting prospects in the grid - **with an opt-in setting to enable automatic enrichment** of qualified prospects. This change shapes that seam before the `enrichment` capability is built, so the capability builds against corrected canon rather than encoding a contradiction. It closes the roadmap open question "Enrichment placement (M1 vs M2)".

## Scope

**In:** the trigger model for enrichment - how a Prospect moves into the enriched state (default manual; opt-in automatic), how that interacts with drafting, and where the auto-enrich preference lives. **Out:** the `EnrichmentProvider` port mechanics and the Apify adapter (already governed by D4/ADR-0002; built by the `enrichment` capability), the dossier shape (domain-model already models `Dossier`), and any UI implementation (the `enrichment`/`prospect-list` capabilities and the prototype wire it).

## Views

- `use-cases` - **Skip.** No new actor or system-boundary goal; this refines when an existing step fires (the CRM user already "acts on prospects"). A one-line note suffices.
- `domain-model` - **Required.** The Prospect lifecycle changes: `Enriched` becomes a user- or auto-triggered side-transition, not a mandatory stage; `Qualified -> Drafted` is the default path; enrichment triggers a re-draft.
- `system-design` - **Skip.** No new container or external system; the `EnrichmentProvider` port and Apify actor are already in canon (ADR-0002). A one-line note records that only the *trigger* changes, not the topology.
- `deployment` - **Skip.** Where things run is unchanged.

## Quality attributes

- **Cost control (primary):** enrichment is the expensive, paid step (Apify per prospect); the default-manual trigger means spend is opt-in, and auto-enrich is an explicit, revocable choice - never a silent default. This is the architecturally-significant constraint the trigger model must honor.
- **Reversibility:** turning auto-enrich off must immediately stop new auto-enrichment without affecting already-enriched prospects.
- n/a this slice: latency, availability (enrichment is async/background and optional).

## Impact on canon

- **overview:** `docs/product-overview.md` section 4 (pipeline) - annotate that enrichment is optional and user-triggered by default with opt-in auto; section 9 open questions - resolve "Enrichment placement". The locked-decisions table gains a pointer to ADR-0007 (refines D5).
- **system-wide views:** none (no glossary/system-context/cross-cutting/deployment change).
- **area views:** `docs/architecture/domain-model.md` - the Prospect lifecycle diagram and its notes (Enriched as optional user/auto side-transition; default `Qualified -> Drafted`; re-draft after enrichment).
- **ADRs:** `docs/adr/0007-user-triggered-optional-enrichment.md` (refines D5 and ADR-0005).
- **roadmap:** `docs/roadmap.md` - mark the "Enrichment placement (M1 vs M2)" open question resolved.
