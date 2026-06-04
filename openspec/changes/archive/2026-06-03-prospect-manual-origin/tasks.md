## 0. Cross-view consistency check

- [x] 0.1 Every domain event maps to a lifecycle transition: `ProspectAddedManually` -> the new `[*] --> New (origin = manual)` entry; `ProspectScored` -> `New --> Qualified|BelowBar` (unchanged). Confirm no orphan event or state.
- [x] 0.2 Every use case traces to the entity change: UC1/UC2 (add and work a manual lead) rely on `Prospect.origin`, nullable `signal_id`, and the manual identity columns - all present in domain-model.md.
- [x] 0.3 The quality attributes are honored by the model: integrity (the CHECK makes "signal-derived but missing its signal" unrepresentable), consistency (the coalescing person-identity seam, no per-origin branching), backward-compat (additive migration, `origin` defaults to `signal`).
- [x] 0.4 Verification gate: /verify-gate has passed for the domain-model view and ADR-0010 being promoted - groundedness ledger has no unsupported claims, Chair verdict is not rework, the record's git hash-object matches current content, and human sign-off is recorded for ADR-0010. See docs/verification-gate.md.

## 1. Reconcile the spine

- [x] 1.1 docs/product-overview.md MVP scope ("In"): add manual lead entry as an in-scope entry path (a person added by hand, no signal), alongside configurable signal sources.
- [x] 1.2 docs/product-overview.md "Source types resolve to different entities" / pipeline note: add that a prospect may originate without a signal (manual origin), so a signal/raw-item-is-not-a-lead still holds and now a lead need not have a signal at all.
- [x] 1.3 docs/product-overview.md locked-decisions table: on the D5 row (which already points to ADR-0005), note that ADR-0005 is superseded by ADR-0010 - which carries D5's per-person scoring and the fan-out forward and adds the manual origin. ADR-0010 does not itself add a new refinement to D5 (it inherits ADR-0005's via the supersedes chain), so do not tag it as refining D5.
- [x] 1.4 docs/product-overview.md "Source types resolve to different entities" canonical-noun list: change `Prospect (a person under evaluation, fanned out from a signal)` to `Prospect (a person under evaluation, fanned out from a signal or entered manually)`, so no canon sentence still asserts every prospect derives from a signal.

## 2. Distribute the views by scope

- [x] 2.1 docs/architecture/glossary.md: update the **Prospect** definition to "a person under evaluation, derived from a signal or entered manually by the CRM user"; add **Prospect origin** and **Person identity** terms (from this change's domain-model.md Glossary).
- [x] 2.2 docs/architecture/domain-model.md (flat, single implicit area): revise the **Prospect** entity (add `origin`, make `signal_id` nullable, add the manual identity columns), the ERD cardinality from `SIGNAL ||--o{ PROSPECT` to `SIGNAL |o--o{ PROSPECT` and its note (rewrite the opening framing to "a prospect has at most one Signal - exactly one for signal-origin, none for manual"; add the per-origin CHECK invariant), the **Lifecycle** (the second entry into `New` for a manual lead), and the **Domain events** table. In the events table, add `ProspectAddedManually` AND revise the existing `ProspectScored` trigger text from "qualify job runs the rubric over a signal-derived person" to read identity through the seam regardless of origin (it must not still say "signal-derived person" after promotion). Keep every other entity/relationship unchanged. Strip any `<!-- v:... -->` anchors.
- [x] 2.3 docs/architecture/domain-model.md "Not modeled yet" note: add that cross-origin identity resolution (a manual lead duplicating a signal-derived prospect) is deferred, consistent with per-source dedup.

## 3. Promote ADRs

- [x] 3.1 Reconfirm the next free ADR number against docs/adr/ (expect 0010; bump if another change landed first), then promote adr/0010-prospect-origin-signal-or-manual.md to docs/adr/0010-prospect-origin-signal-or-manual.md. Once in docs/adr/ it is immutable. Do NOT edit ADR-0005 (it stays accepted; the supersedes chain is forward-only).

## 4. Cross-link

- [x] 4.1 Cross-link the canon: docs/architecture/domain-model.md Prospect entity and lifecycle reference ADR-0010 (as they reference ADR-0005/0008 today); the overview D5 row links ADR-0010; ADR-0010's Source/Refines already point back to the domain model and D5. Confirm no canon view points the reader at the archived use-cases.md (re-slice personas/journey into the overview if referenced).

## 5. Verify canon integrity

- [x] 5.1 `npm run verify` passes - in particular tests/canon-integrity.test.ts against docs/architecture/canon.manifest.json: required sections present, all canon links and intra-canon anchors resolve, no dangling references to archive-only artifacts, and no leaked `<!-- v:... -->` anchors. (No code or migration ships from this change; the schema/migration lands in the separate manual-lead-entry code change.)
