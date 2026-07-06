## 0. Cross-view consistency check

<!-- Gate tasks (not docs) confirming the drafted views agree, run before promotion. -->
- [ ] 0.1 <!-- e.g., every domain event maps to a lifecycle transition -->
- [ ] 0.2 <!-- e.g., every use case traces to at least one entity -->
- [ ] 0.3 <!-- e.g., every container appears in deployment (when deployment is in scope) -->
- [ ] 0.4 <!-- verification gate: /verify-gate passed for each promoted view + ADR - ledger has no unsupported claims, Chair verdict not rework, record git hash-object matches current content, (ADRs) human sign-off recorded. See docs/process/verification-gate.md. -->

## 1. Reconcile the spine

<!-- Update the specific docs/product-overview.md sections this change
     touches. Name the sections. -->
- [ ] 1.1 <!-- e.g., update the locked-decisions table with new ADR rows -->

## 2. Distribute the views by scope

<!-- Promotion is NOT file-to-file. Re-slice each draft view into the living-canon
     home matching its scope; keep ONE copy of system-wide content.
     glossary -> glossary.md (or overview); ERD/lifecycle/events -> areas/<area>/domain-model.md;
     C4 L1 -> system-context.md (or overview); C4 L2 + flows -> areas/<area>/system-design.md;
     cross-cutting -> cross-cutting.md (or overview); decisions -> ADRs. -->
- [ ] 2.1 <!-- e.g., promote signals ERD/lifecycle/events to docs/architecture/areas/signals/domain-model.md -->
- [ ] 2.2 <!-- e.g., merge the glossary terms into docs/architecture/glossary.md -->

## 3. Promote ADRs

<!-- Move each ADR drafted in this change's adr/ folder into docs/adr/ with the next
     free 4-digit sequence number, then cross-link from the spine. Once in docs/adr/
     they are immutable - do not rewrite them. If the adr step produced only
     adr/none.md, there is nothing to promote. -->
- [ ] 3.1 <!-- e.g., promote adr/0004-prospect-fan-out.md to docs/adr/0004-prospect-fan-out.md and cross-link -->

## 4. Cross-link

<!-- Wire links between the overview, the view docs, and the ADRs. -->
- [ ] 4.1 <!-- e.g., link overview sections to their view docs -->
