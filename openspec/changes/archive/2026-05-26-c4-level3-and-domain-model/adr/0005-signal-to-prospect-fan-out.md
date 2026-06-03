# ADR-0005: Signal-to-prospect fan-out is one-to-many

- Status: proposed
- Date: 2026-05-26
- Supersedes: none
- Refines: D5 (docs/product-overview.md section 3 locked decision)
- Source: system-design.md (Decisions and trade-offs), domain-model.md (Entity model)

## Context

A signal is not a prospect. <!-- v:derives docs/product-overview.md section 4 --> The entry point is configurable, and source kinds resolve to different entities: a person source yields one person, but a company or content source must expand into the many people worth contacting. <!-- v:fact docs/product-overview.md section 4 -->

D5 reads "Qualify scores on the signal as the cost gate," and the current L1/L2 canon echoes it ("ICP score on the signal"). <!-- v:fact docs/product-overview.md section 3 (D5) --> That phrasing is precise for person sources, where the signal is the person, but imprecise under fan-out: for a company or content source the scored person is produced by expansion, so the unit being scored is the person, not the shared signal. <!-- v:derives docs/product-overview.md section 4 --> This ADR therefore refines D5: the cheap signal-level pass is still the cost gate that decides whether to spend on enrichment, but the score is a property of the per-person prospect. The promotion of this change updates the two canon lines (system-context.md, system-design.md) to that fan-out-consistent wording. <!-- v:decision -->

Because Drizzle migrations are immutable once applied, this cardinality is decided once and propagates to qualification, normalize-expand, enrichment, drafting, and the queue. <!-- v:fact CLAUDE.md --> A 1:1 signal=prospect shape would satisfy person sources but break the moment a company or content source expands one signal into many people, forcing the migration the immutable-migration rule then makes costly - the exact rework this change exists to prevent. <!-- v:decision -->

## Decision

We will model the signal-to-prospect relationship as one-to-many: a `Prospect` references exactly one `Signal`, and one `Signal` may produce zero, one, or many `Prospect`s. <!-- v:decision --> A person source produces one prospect per signal; a company or content source expands one signal into many person prospects via the normalize-expand stage. <!-- v:derives docs/product-overview.md section 4 --> The ICP score is recorded per person, against the prospect (a `Scoring` record referencing the prospect and the rubric version), never on the shared signal - which is what makes the refinement of D5 above concrete in the data model. <!-- v:decision --> The exact shape of the `Scoring` record is owned by the domain model and the qualification feature, not frozen here; this ADR fixes only the fan-out cardinality and that the scored unit is the person. <!-- v:decision --> Dedup remains scoped per source on the `Signal`; cross-source identity resolution across prospects is explicitly out of scope and deferred. <!-- v:derives openspec/changes/signal-ingestion/design.md (D-B) -->

## Consequences

Easier: company and content sources need no schema change to land - expansion is new prospect rows under the one-to-many model, not a new shape <!-- v:decision -->; and because the score is a per-person record, the learning loop binds outcomes to the score each person was acted on, from day one. <!-- v:derives D7 --> Harder: person sources carry a one-to-many relation they exercise only at N=1, a small modeling cost accepted to keep the company/content path migration-free <!-- v:decision -->; and the L1/L2 canon must be edited at promotion so it no longer says the score lives on the signal (tracked as a promotion task). <!-- v:decision --> Rules out: treating a signal as directly actionable or contactable - by construction of the one-to-many model, all action targets a prospect (consistent with D2's human-only action). <!-- v:decision --> Risk accepted: the same human arriving from two sources yields two signals and therefore two prospect lineages until a future prospect-layer identity-resolution change merges them; this is called out so it is not mistaken for a defect. <!-- v:derives openspec/changes/signal-ingestion/design.md (D-B) -->
