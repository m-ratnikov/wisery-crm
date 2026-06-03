## Why

The product spine fixes the pipeline and locked decisions D1-D10, and L1/L2 fix the system boundary and the single app container, but the whole-pipeline data model has never been drawn and L2 deliberately stopped above the component level. <!-- v:fact docs/architecture/system-design.md --> Every prior change Skipped the domain-model view, so the load-bearing `signal -> N prospects` fan-out, the config-as-data entities, and the internal component structure the eight remaining capabilities build into exist only implicitly. <!-- v:fact openspec/changes/archive/2026-05-24-c4-level2-architecture/domain-model.md --> This change resolves the data model and the component decomposition before feature implementation, closing the product-overview open question on the data model's shape. <!-- v:derives docs/product-overview.md section 9 -->

## Scope

**In:**
- The whole-MVP-pipeline domain model: entities, the fan-out cardinalities, the core entity lifecycle, and the domain events that map to job stages, across roadmap #1-#10. <!-- v:derives docs/roadmap.md -->
- The C4 level 3 component decomposition of the single app container: the web/RSC surface, the in-process worker pipeline, the role-agnostic domain cores, the D4/D9 ports and their adapters, and the platform facades. <!-- v:derives docs/architecture/system-design.md -->
- The data-model invariants worth freezing as ADRs (the fan-out cardinality; the decision to maintain a pre-code L3 view as living canon).

**Out:**
- Any migration or table creation. The model is drawn, not built; downstream tables land with their feature, honoring Drizzle-migrations-immutable and "domain tables arrive with features". <!-- v:derives src/lib/db/schema.ts --> Only `sources`/`scans`/`signals` are specified for build, by the `signal-ingestion` change (its first migration, not yet applied). <!-- v:fact openspec/changes/signal-ingestion/design.md -->
- Any change to L1 actors/externals or the L2 container set - both are unchanged canon and only referenced here. <!-- v:derives docs/architecture/system-context.md -->
- Multi-tenant plumbing and the `tenant` entity (D1, deferred). <!-- v:derives D1 -->
- Where-things-run (deployment): unchanged from ADR-0001. <!-- v:derives ADR-0001 -->

## Views

- `use-cases`: Required - the pipeline is user-facing; the actors and goals ground every entity and component. <!-- v:derives docs/product-overview.md section 4 -->
- `domain-model`: Required - the data model is the primary deliverable of this slice. <!-- v:decision -->
- `system-design`: Required - it carries the C4 L3 component view, the new content this change adds. <!-- v:decision -->
- `deployment`: Skip - where-things-run is unchanged (one Node process + managed Postgres, ADR-0001); the conceptual scaling hook stays in system-design cross-cutting. <!-- v:derives ADR-0001 -->

## Quality attributes

The architecturally-significant requirements this data model and decomposition must satisfy (not a generic list):

- **Traceability / durability**: every signal resolves to its source and scan, and every prospect to its signal; FKs are `NOT NULL` + `RESTRICT` so history is never silently lost. <!-- v:derives openspec/changes/signal-ingestion/design.md (D-D) -->
- **Idempotency**: re-scanning a source persists no duplicate signal `(source_id, dedup_key)`; re-running a billed LLM/enrich step does not double-bill. <!-- v:derives openspec/changes/signal-ingestion/design.md (D-B) -->
- **Learning-loop integrity (D7)**: an outcome binds to the score it acted on, and a score binds to its rubric version, so a later rubric edit never rewrites history. <!-- v:derives D7 -->
- **Privacy boundary (D10)**: prospect PII is concentrated in the runtime entities (signal payload, dossier, draft) so field minimization has one seam to attach to at productization. <!-- v:derives D10 -->
- **Peel-safety (ADR-0001)**: the decomposition keeps web and worker components sharing state only through Postgres - domain cores depend on `db` only - so the no-rewrite worker peel stays available. <!-- v:derives ADR-0001 -->

## Impact on canon

Promotion stays flat (one connected model; no area split yet - the whole-pipeline ERD would fragment across area folders, README rule 1). <!-- v:derives docs/architecture/README.md (rules 1, 5) -->

- Overview sections (docs/product-overview.md): section 4 (pipeline - reconcile entity nouns), section 9 (close the data-model open question), and the locked-decisions table (cross-link the two new ADRs).
- System-wide views: new `docs/architecture/glossary.md` (the ubiquitous language, one per bounded context); `docs/architecture/cross-cutting.md` (data-sensitivity delta - downstream entities now carry PII).
- Area views (flat for now): new top-level `docs/architecture/domain-model.md` (ERD, lifecycle, events); the C4 L3 component section appended into the existing top-level `docs/architecture/system-design.md`.
- ADRs: `docs/adr/0005-*` (the signal -> N prospect fan-out cardinality invariant) and `docs/adr/0006-*` (maintain a pre-code C4 L3 component view as living canon - the recorded override of the schema's no-L3-pre-code default).
