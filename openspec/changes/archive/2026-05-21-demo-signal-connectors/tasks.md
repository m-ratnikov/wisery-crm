## 0. Cross-view consistency check

- [x] 0.1 Every domain event maps to a lifecycle transition (SignalPersisted/RawItemDropped <-> Deduped branch)
- [x] 0.2 Every persona story traces to an entity (consultant -> Source; isolation -> Scan)
- [x] 0.3 Every container appears where expected (deployment skipped, so worker mapping confirmed in system-design)

## 1. Reconcile the spine

- [x] 1.1 Update docs/architecture-overview.md pipeline diagram to show Source -> Scan -> Signal as the entry point
- [x] 1.2 Add Source / Connector / RawItem / Signal to the overview glossary
- [x] 1.3 Mark the "how do sources plug in" open question resolved, linking ADR-0004

## 2. Write the view docs

- [x] 2.1 Promote domain-model.md to docs/architecture/domain-model.md
- [x] 2.2 Promote system-design.md to docs/architecture/system-design.md

## 3. Promote ADRs

- [x] 3.1 Move adr/0004-signal-connector-contract.md to docs/adr/0004-signal-connector-contract.md (reconfirm 0004 is free), set Status accepted, cross-link from spine

## 4. Cross-link

- [x] 4.1 Link overview pipeline section to docs/architecture/system-design.md and the domain-model view
