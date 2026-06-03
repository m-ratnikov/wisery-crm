## 0. Cross-view consistency check

- [x] 0.1 Every domain event in domain-model.md maps to a Prospect lifecycle transition (or is explicitly an ingestion event on the immutable Signal), and every lifecycle transition has a triggering event.
- [x] 0.2 Every use case in use-cases.md traces to at least one entity in domain-model.md and one component in system-design.md (UC1->Source/Rubric/UserProfile + config view; UC2->Signal/Prospect + scan/qualify components; UC3->Dossier/Draft + queue; UC4->Outcome + queue).
- [x] 0.3 Every component in the C4 L3 diagram has a row in the component catalog with an owning capability from docs/roadmap.md, and every port named has its adapters drawn implementing it.
- [x] 0.4 Deployment is Skip and adds no container, so the "every container appears in deployment" check is N/A by design - confirm the deployment.md note says nothing ran somewhere new.
- [x] 0.5 Verification gate: `/verify-gate` passed for domain-model.md, system-design.md, adr/0005, and adr/0006 - groundedness ledger has no unsupported claims, Chair verdict is not rework, each record's `git hash-object` matches current content, and human sign-off is recorded for both ADRs (immutable-canon promotion). See docs/verification-gate.md.
- [x] 0.6 Mechanical checks green: `npm test` (mermaid.parse over every diagram, arch-links) passes for the change and docs.
- [x] 0.7 Both deferred canon rewrites this change commits to are applied before archive, neither dropped: task 1.4 (ADR-0005 refines D5 - rewrite the "score on the signal" lines in docs/architecture/system-design.md and docs/architecture/system-context.md) and task 2.6 (ADR-0006 - annotate the schema instruction + README). This is the single consolidated checkpoint for the promotion-time canon edits.

## 1. Reconcile the spine

- [x] 1.1 docs/product-overview.md section 4 (pipeline): reconcile the canonical nouns with domain-model.md's glossary (Source, Signal, Prospect, Scoring, Dossier, Draft, Outcome, Rubric, User Profile) and confirm the "signal is not a lead" note now points to ADR-0005.
- [x] 1.2 docs/product-overview.md section 9 (open questions): close the data-model open question (it is now resolved by docs/architecture/domain-model.md) and the L2-decomposition follow-on (L3 now in system-design.md).
- [x] 1.3 docs/product-overview.md locked-decisions table: add cross-links to ADR-0005 (fan-out) and ADR-0006 (pre-code L3 view) where D3/D4/D5 reference the data model and seams.
- [x] 1.4 ADR-0005 refines D5: rewrite the two canon lines that say the score is on the signal - docs/architecture/system-design.md (the intelligence-pipeline flow note "ICP score on the signal") and docs/architecture/system-context.md ("qualify scores on the signal as the cost gate") - to the fan-out-consistent wording (the cheap signal gates spend; the ICP score is recorded per person, against the prospect, as a Scoring record). Without this edit the canon contradicts ADR-0005.

## 2. Distribute the views by scope (flat - no area split)

- [x] 2.1 Create docs/architecture/glossary.md from domain-model.md's Glossary (the ubiquitous language, one per bounded context); strip the `<!-- v:... -->` anchors during promotion.
- [x] 2.2 Create docs/architecture/domain-model.md from domain-model.md's Entity model + Lifecycle + Domain events (top-level, flat per README rule 5); strip anchors; add the standard "Promoted from change ..." provenance line and cross-links.
- [x] 2.3 Append the "Components (C4 L3)" section (diagram, legend, catalog, role mapping, ports/adapters direction) and the L3 runtime flow from system-design.md into the existing docs/architecture/system-design.md, below the L2 content; strip anchors; do not duplicate the L1/L2 content (it is referenced, not redrawn).
- [x] 2.4 Merge the data-sensitivity delta from system-design.md's cross-cutting into docs/architecture/cross-cutting.md (prospect PII spans Signal payload, Scoring reason/summary, Dossier, Draft; D10 seam); strip anchors. Leave the unchanged concerns untouched.
- [x] 2.5 Confirm no system-wide content was duplicated per area (there are no areas) and that the clean promoted views contain zero `<!-- v:... -->` comments.
- [x] 2.6 Realize the ADR-0006 override link (it cannot bind the schema by itself): annotate the spec-driven-architecture schema's system-design instruction in openspec/schemas/spec-driven-architecture/schema.yaml with a pointer to ADR-0006, and note the pre-code-L3 exception in docs/architecture/README.md, so a future author reading the schema's "no L3" rule sees it is intentionally overridden here.

## 3. Promote ADRs

- [x] 3.1 Move adr/0005-signal-to-prospect-fan-out.md to docs/adr/0005-signal-to-prospect-fan-out.md with the next free sequence number (reconfirm 0005 against docs/adr/ in case another change landed first); set Status to accepted only after human sign-off; strip anchors. Once in docs/adr/ it is immutable.
- [x] 3.2 Move adr/0006-pre-code-l3-component-view.md to docs/adr/0006-pre-code-l3-component-view.md (reconfirm the number); set Status accepted after sign-off; strip anchors.
- [x] 3.3 Cross-link both ADRs from docs/product-overview.md and from docs/architecture/{domain-model,system-design}.md.

## 4. Cross-link

- [x] 4.1 Add provenance + related-doc links to docs/architecture/domain-model.md and the new L3 section (to system-context.md, system-design.md L2, cross-cutting.md, product-overview.md, ADR-0001..0006).
- [x] 4.2 Update docs/architecture/README.md layout section to list the now-present glossary.md and domain-model.md (they were described as planned).
- [x] 4.3 Delete the throwaway draft folder openspec/changes/c4-l3-domain-model/ (its content is now folded into this change's domain-model.md and system-design.md).
- [x] 4.4 Before archive, confirm the architecture gates pass: `/verify-gate` clean (task 0.5) and `npm test` green (task 0.6). Note: `openspec validate` is schema-agnostic and false-errors with "no deltas" on every spec-driven-architecture change (the archived c4-level2-architecture change carried no specs/ deltas either), so it is NOT the gate here - do not block on it.
