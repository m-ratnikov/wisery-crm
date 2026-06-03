# ADR-0007: Enrichment is user-triggered and optional, with opt-in automatic execution

- Status: accepted
- Date: 2026-06-01
- Refines: D5 (docs/product-overview.md section 3), ADR-0005 (signal-to-prospect fan-out)
- Supersedes: none
- Source: openspec/changes/enrichment-trigger (this change)

## Context

The product overview (section 4 pipeline) and the domain-model lifecycle draw enrichment as an automatic, score-gated stage: `Qualify -> (>= 3) -> Deep Enrich -> Draft`. Deep enrichment is the expensive step - it spends Apify per prospect (D4/ADR-0002) - so an automatic-on-every-qualified-prospect default spends money on the user's behalf without their say. The locked product direction is the opposite: the user decides which qualified prospects are worth enriching, and only optionally lets the system do it automatically. The roadmap carried this as the open question "Enrichment placement (M1 vs M2)"; D5's intent ("draft from the enriched dossier, not the thin signal") argued for enrichment-before-drafting, while cost and speed argued for drafting from the signal first. This ADR resolves both: drafting from the signal is the default, and enrichment is a separate, opt-in enhancement.

## Decision

Enrichment is **user-triggered and optional by default**, with an **opt-in setting to enable automatic execution**:

- The default pipeline path is `Qualified -> Drafted`: a qualified prospect is drafted from the thin person signal, no enrichment required.
- A user triggers deep-enrichment explicitly - from a prospect's detail surface, or by multi-selecting prospects in the grid and enriching the batch. Enrichment builds the `Dossier` and triggers a **re-draft** from it (`Enriched -> Drafted`); `Draft` is already regenerable (ADR-0005 / domain-model), so this is additive.
- A per-tenant **auto-enrich setting** (config-as-data, D1/D6) MAY be turned on; when on, enrichment is auto-enqueued on `ProspectQualified`. It is off by default, is an explicit and revocable choice, and turning it off stops new auto-enrichment immediately without affecting already-enriched prospects. The exact storage location of the flag (user profile vs a settings row) is owned by the `enrichment` capability, not fixed here.
- The score gate (>= 3, D5) still decides what is *eligible* for drafting/enrichment; enrichment is never applied to below-bar prospects. The `EnrichmentProvider` port and Apify adapter (D4/ADR-0002) are unchanged - only the trigger changes.

This refines D5: the cheap signal-level score remains the cost gate for the pipeline, and enrichment is a user-controlled spend on top, not an automatic consequence of qualifying.

## Consequences

Easier / safer: the expensive Apify spend is opt-in by construction - never silently incurred - which is the architecturally-significant cost-control attribute; the first walking product ships without an enrichment dependency on the critical path (draft from signal), and enrichment thickens drafts when the user asks. The learning loop is unaffected (outcomes still bind to the score). Harder: the Prospect lifecycle gains an optional side-transition (`Qualified -> Enriched` and `Drafted -> Enriched`, both user/auto-triggered) and a re-draft edge, so drafting must handle both signal-only and dossier-grounded drafts (it already does - drafts are regenerable). Rules out: an automatic enrich-on-qualify default; the `enrichment` capability MUST implement the trigger (manual action + batch) and the auto-enrich flag, not an unconditional gated stage. Supersedes the automatic `Qualified -> Enriched -> Drafted` reading of product-overview section 4 and the domain-model lifecycle, which are updated at promotion to show enrichment as an optional, user/auto-triggered side-transition with `Qualified -> Drafted` as the default path.
