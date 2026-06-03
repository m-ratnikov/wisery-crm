## 1. Promote the ADR

- [x] 1.1 Copy `adr/0007-user-triggered-optional-enrichment.md` to `docs/adr/0007-user-triggered-optional-enrichment.md` (becomes immutable accepted canon)

## 2. Promote the domain-model lifecycle revision

- [x] 2.1 In `docs/architecture/domain-model.md`, replace the Prospect lifecycle diagram with the revised one (`Qualified -> Drafted` as the default path; `Qualified -> Enriched` and `Drafted -> Enriched` as user/auto-triggered optional side-transitions; `Enriched -> Drafted` re-draft)
- [x] 2.2 Update the lifecycle/cardinality prose: the `PROSPECT ||--o| DOSSIER` note now reflects enrichment as optional and user-triggered by default (opt-in auto), not an automatic score gate; reference ADR-0007

## 3. Promote the overview canon

- [x] 3.1 In `docs/product-overview.md` section 4 (pipeline), annotate that deep-enrich is optional and user-triggered by default, with an opt-in auto-enrich setting; the default path is qualify -> draft (from the signal)
- [x] 3.2 In `docs/product-overview.md` section 9 (open questions), mark "Enrichment placement (M1 vs M2)" resolved by ADR-0007; add an ADR-0007 pointer to the D5 row of the locked-decisions table (refines D5)
- [x] 3.3 In `docs/roadmap.md`, mark the "Enrichment placement (M1 vs M2)" open sequencing decision resolved (enrichment in M1 as an optional user/auto-triggered step), pointing to ADR-0007

## 4. Verify and archive

- [x] 4.1 Confirm all new/edited mermaid parses and canon links resolve (`npm test` covers the mermaid + arch-link + canon-integrity tests)
- [x] 4.2 `/opsx:verify` (the architecture change is coherent and the canon edits match the proposal's Impact-on-canon contract) and archive
