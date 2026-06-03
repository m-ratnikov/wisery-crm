## Context

The pipeline produces prospects, scores, drafts, and (optionally) dossiers. Anchor view #3 is the browse/manage grid over them and the home of the enrich trigger + auto-enrich toggle (ADR-0007). This is a read-model + UI over existing tables and the enrichment/drafting/settings entry points - no new schema, mirroring how icp-config graduated a prototype screen to a wired Server Component + Server Actions.

## Goals / Non-Goals

**Goals:** a `listProspects` / `getProspectDetail` read-model with the derived enriched/drafted facets (ADR-0008); the wired grid + detail; Server Actions for enrich (single + batch), regenerate-draft, and auto-enrich toggle, calling existing entry points. **Non-Goals:** the review/approve queue (anchor #2); sending; new pipeline behavior; new tables.

## Decisions

### D-A: The read-model avoids join multiplicity by composing small queries
`listProspects()`: one base query (`prospects` innerJoin `signals` innerJoin `sources`, ordered newest-first - one row per prospect, no scoring join to avoid duplicate rows when a prospect has been re-scored), plus three cheap lookups composed in memory: the latest scoring per prospect (from `scorings` ordered by `scored_at` desc, first per prospect wins), the set of prospect ids with a dossier, and the set with a `selected` draft. Each row maps to `{ id, status, score, summary, sourceKind, name, enriched, drafted, createdAt }`. `getProspectDetail(id)` returns the prospect + its latest scoring + its selected draft (body) + its dossier.

### D-B: enriched/drafted are derived, never read from status
Per ADR-0008, `enriched` = a dossier exists, `drafted` = a selected draft exists; both come from the relation lookups above, not from `status`. `status` is the disposition column. This keeps the single source of truth and matches the lifecycle model.

### D-C: `name` is best-effort from the signal payload
The display label is `signal.payload.name` when the payload is an object with a string `name`, else a fallback (the signal kind). The payload is opaque JSONB, so the read-model extracts defensively; the UI never assumes a shape.

### D-D: The anchor view is a Server Component + Server Actions (coverage-excluded UI)
A route under `src/app/prospect-list/` renders the grid from `listProspects()` and a detail drawer from `getProspectDetail()`. Server Actions (`'use server'`): `enrichAction(prospectId)` -> `enqueueEnrich`; `batchEnrichAction(ids)` -> `enqueueEnrichForProspects`; `regenerateDraftAction(prospectId)` -> `enqueueDraft(id, true)` (forced re-draft); `setAutoEnrichAction(on)` -> `setAutoEnrich`; each `revalidatePath`s the route. The actions are thin wrappers over built entry points.

### D-E: Auth deferred (D1), documented
The Server Actions are unauthenticated by design (single-user MVP), with the same note as icp-config - the one place that decision surfaces.

## Risks / Trade-offs

- **In-memory composition of the read-model** -> at single-user volume the prospect count is small; the three lookups are indexed and cheap. If volume grows, fold into a single SQL with a lateral/distinct-on - deferred.
- **Eventually-consistent grid** -> enrich/draft are async jobs; the grid reflects results after the job runs and the route revalidates. The action gives immediate feedback (queued), the row updates on refresh - acceptable for a background-pipeline product.
- **Latest-score-first assumes additive scorings** -> consistent with the domain model (re-scoring appends; the latest against the active rubric gates), so taking the newest scoring is correct.

## Migration Plan

No schema/migration. 1. Build `src/lib/prospect/read.ts` (`listProspects`, `getProspectDetail`) with integration tests. 2. Build the route (page + actions + grid/detail components) adapted from the prototype. 3. Update the prototype registry note (graduated). **Rollback:** delete `read.ts` + the route.

## Open Questions

- Where the auto-enrich toggle visually lives (a list header control vs a settings screen) - on the list for MVP (it is the management surface); revisit if a dedicated settings route lands.
- Filtering/sorting set beyond status + score - start with those (the high-judgment cuts), extend per use.
