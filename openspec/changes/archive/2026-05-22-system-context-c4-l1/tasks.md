## 0. Cross-view consistency check

- [x] 0.1 Every actor / external system in the L1 diagram traces to a use case (CRM user -> UC1-6; Signal source -> UC2; scraping/enrichment provider -> UC2; LLM API -> UC2/UC3; Prospect -> UC4).
- [x] 0.2 The human-only action edge holds: no system -> Prospect edge exists; the only path to the Prospect is CRM user -> Prospect (D2).
- [x] 0.3 The provider is consistently optional/pluggable across use-cases.md and system-design.md (dashed edge, "or self-hosted", Apify only as example).

## 1. Reconcile the spine (docs/product-overview.md)

- [x] 1.1 Cross-link the new system-context view from section 4 (the pipeline).
- [x] 1.2 In section 9 (open questions), mark the high-level-boundary question as addressed, pointing to docs/architecture/system-context.md.
- [x] 1.3 Clean up section 9's dangling references to the deleted ADR-0002/0003/0004 and the deleted docs/architecture/system-design.md; re-point to what exists (ADR-0001 and the relevant D-decisions).

## 2. Distribute the views by scope

- [x] 2.1 Promote the C4 L1 system context (the diagram, the per-edge "what crosses the boundary" notes, and the boundary runtime flow) to a NEW docs/architecture/system-context.md.
- [x] 2.2 Promote the cross-cutting notes (trust boundaries, data-sensitivity / PII edges, external-dependency cost/availability) to a NEW docs/architecture/cross-cutting.md.
- [x] 2.3 use-cases.md is not promoted as a file, but its durable parts are: Actors and the Primary journey are carried into system-context.md (the diagram actors and the boundary runtime flow, task 2.1). The use-case briefs (UC1-6) and acceptance signals are NOT architecture canon - they are the seed for future OpenSpec capability specs (openspec/specs/) and stay in the archived change folder as the record. Do not create area views (domain-model skipped); leave the L2 container view and the D5/UC3 sequencing recorded only as deferred/open.

## 3. Promote ADRs

- [x] 3.1 Nothing to promote - the adr step produced none.md.

## 4. Cross-link

- [x] 4.1 Wire links both ways: product-overview sections 4/9 <-> docs/architecture/system-context.md, and system-context.md <-> cross-cutting.md and ADR-0001.
