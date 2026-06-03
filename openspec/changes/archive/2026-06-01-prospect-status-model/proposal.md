## Why

The `Prospect.status` vocabulary in the domain model (`new, scored, below_bar, qualified, enriched, drafted, queued, acted, dismissed, closed`) conflates three different categories: scoring disposition, *artifacts produced* (`enriched`, `drafted`), and human-facing disposition. `enriched` and `drafted` are not funnel positions - they are facts about whether a `Dossier` / `Draft` exists, already represented by the `PROSPECT ||--o| DOSSIER` and `PROSPECT ||--o{ DRAFT` relations - and they cannot be held by a single linear status (ADR-0007 made enrichment optional and repeatable: a prospect can be drafted, then enriched, then re-drafted). This change makes `status` a single clean category - the prospect's disposition in the human-facing pipeline - and derives "enriched"/"drafted" from the relations. Cheapest to do now: only `new/scored/below_bar/qualified` exist in code, and drafting/enrichment/review-queue (which would otherwise encode `enriched`/`drafted` as statuses) are not yet built.

## Scope

**In:** the `Prospect.status` vocabulary and the Prospect lifecycle - which values exist, what category `status` represents, and how drafting/enrichment relate to it. **Out:** the `DOSSIER`/`DRAFT`/`OUTCOME` entity shapes (unchanged), the enrichment trigger (ADR-0007, already decided), and any multi-touch / re-open-a-closed-prospect modeling (deferred).

## Views

- `use-cases` - **Skip.** No new actor or boundary goal.
- `domain-model` - **Required.** The `PROSPECT.status` vocabulary, the lifecycle state diagram, and the domain-events table change.
- `system-design` - **Skip.** No container/topology change.
- `deployment` - **Skip.**

## Quality attributes

- **Model clarity / one source of truth:** "is this prospect enriched / drafted" has exactly one representation (the `DOSSIER` / `DRAFT` relations), not two (relation + status) that can disagree. n/a this slice: performance, availability.

## Impact on canon

- **overview:** none structural (the pipeline prose already describes the funnel; section 4 was updated by ADR-0007). No locked-decision change.
- **area views:** `docs/architecture/domain-model.md` - the `PROSPECT` entity `status` comment (line ~68), the Prospect lifecycle state diagram, the domain-events table (`ProspectEnriched`/`DraftGenerated` no longer set a status; scoring goes `New -> Qualified/BelowBar` directly), and the lifecycle prose.
- **ADRs:** `docs/adr/0008-prospect-status-is-disposition.md` (refines ADR-0005 and ADR-0007).
- **code conformance (not canon, but in this change's tasks):** `src/lib/qualify/status.ts` drops `scored` from the Zod enum (it is never set - qualification gates straight to `qualified`/`below_bar`); `new` is kept (the appeared-but-unscored state, load-bearing once company/content fan-out creates prospects before scoring).
