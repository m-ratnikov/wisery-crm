## 0. Cross-view consistency check

- [x] 0.1 Every domain event in domain-model.md maps to a step in the use-cases primary journey and to a flow or note in system-design.md (in particular: SignalApproved produces entity + decision only in all three; PersonRescored and the advisory-promotion side effect appear in none except as explicitly removed).
- [x] 0.2 Every removed concept is removed everywhere: no view still uses Scoring, Qualification, provenance, score_at_time, or re-score as a live concept (grep the four drafted views; mentions must be in removed/superseded framing only).
- [x] 0.3 The use-cases acceptance signals each trace to a decision in system-design.md (Decisions and trade-offs) and to the ADR-0022 Decision bullets; nothing in the ADR decides something absent from the views.
- [x] 0.4 Verification gate per docs/verification-gate.md: /verify-gate passed for domain-model.md, system-design.md, and adr/0022 - groundedness ledger clean, Chair verdict not rework, record git hash-object matches current content, and **human owner sign-off recorded on ADR-0022** (the agent must not self-sign; Status flips to accepted only with the owner's sign-off line).
- [x] 0.5 Mechanical checks: `npm test` green - tests/mermaid.test.ts parses every diagram in the change and docs, tests/arch-links.test.ts finds no broken links.

## 1. Reconcile the spine

- [x] 1.1 docs/product-overview.md **Locked decisions** table: re-state the D5 scorer row and the ADR-0019 scoring rows as signal-only advisory scoring citing ADR-0022; annotate the ADR-0019 row as partially superseded by ADR-0022 (its on-demand generation model stands); reword the D7 row to "learning loop deferred, to be designed over signal advisory data (ADR-0022)".
- [x] 1.2 docs/product-overview.md section 4 **Pipeline architecture**: remove the re-score action and the qualification read from the post-intake picture (approval creates the entity; the advisory score stays at triage).
- [x] 1.3 docs/product-overview.md section 8 **MVP scope** and section 9 **Open questions**: drop person scoring from scope; close any open question that presumed per-person scores; open "shape of the advisory-based learning loop (binding, manual-person participation)".
- [x] 1.4 docs/product-overview.md **Primary journey**: triage step no longer promotes a score; person-workspace step loses re-score; outcome step loses "against the score".

## 2. Distribute the views by scope

- [x] 2.1 Glossary terms into docs/architecture/glossary.md: sharpen **Advisory score** (the only score), remove **Scoring**, **Qualification**, and provenance vocabulary; update **Outcome** (no score snapshot). Strip the v: anchors when promoting.
- [x] 2.2 ERD, lifecycle note, and domain events into docs/architecture/domain-model.md (flat canon, single implicit area): remove the SCORING entity and its relationships, the qualification derived-read note, OUTCOME.score_at_time, and the PersonRescored event; entry annotation "no score either way". Strip the v: anchors.
- [x] 2.3 The re-labeled L1 diagram into docs/architecture/system-context.md (the canon L1 was never re-labeled for the engagement rework; this lands those deferred ADR-0019..0021 label updates together with the advisory-scores-only LLM edge - independent of the scoring decision, noted as bundled true-up). Also update the SAME file's boundary runtime-flow sequence (lines ~57-76): the "qualify (and draft, if enabled)" LLM step becomes the advisory-filter step and the "Scoring against the prospect" annotation is removed. Strip the v: anchors.
- [x] 2.3b system-design content into docs/architecture/system-design.md, concrete edits: (a) L2 app-to-LLM edge label "advisory-score + generate/re-score on demand" -> "advisory-score + generate on demand"; (b) delete the `handlers --> cscore` re-score edge (~line 328); (c) retitle/relocate the `cscore` scoring-core node to the triage slice and drop "re-score reuses this" (~line 282); (d) update the catalog rows for scoring core / Person list + workspace / Queue (~lines 412-417) to remove re-score and Scoring-promotion language; (e) keep the `pq` qualify-prompt node but re-home it as the advisory scorer prompt; (f) shrink the approve-signal key flow to entity + decision (no rubric resolve, no Scoring write). Strip the v: anchors.
- [x] 2.4 cross-cutting notes into docs/architecture/cross-cutting.md: rewrite the D7 learning-loop note to the deferred advisory-based design; delete the provenance-exclusion invariant (moot); note the dropped derived-PII strings (scorings.reason/summary). Strip the v: anchors.

## 3. Promote ADRs

- [x] 3.1 Promote adr/0022-signal-advisory-is-the-only-score.md to docs/adr/0022-signal-advisory-is-the-only-score.md (reconfirm 0022 is still the next free number; immutable once accepted). Requires the owner sign-off from 0.4 recorded in its Status line.

## 4. Cross-link

- [x] 4.1 Wire links: product-overview locked-decisions rows -> ADR-0022; ADR-0022 referenced from the domain-model SCORING-removal note and the system-design flows section; run the arch-links validator (`/arch-links`) to confirm every reference resolves.

## 5. Verify canon integrity

- [x] 5.1 `npm run verify` green - tests/canon-integrity.test.ts passes against docs/architecture/canon.manifest.json: required sections present, no dangling references to archive-only artifacts, all canon links and anchors resolve, no leaked `<!-- v:... -->` anchors.
- [x] 5.2 Coordinate with the companion code change: `remove-person-scoring` archives only after this change's ADR-0022 is accepted; both land together (its tasks.md item 5.1 mirrors this gate).
