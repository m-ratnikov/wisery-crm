## Why

The pipeline produces scored, drafted, sometimes-enriched prospects, but there is no surface to browse and manage them or to trigger enrichment. The prospect list is anchor view #3 (the thesis): the broad browse/manage grid over the whole pipeline, and the home of the **manual + batch enrich** trigger and the **auto-enrich** toggle (ADR-0007). It reads the data the prior capabilities produced - no new tables - and wires the enrichment/draft actions to their existing job entry points.

## What Changes

- **A read-model** (`src/lib/prospect`): `listProspects()` - one row per prospect with its disposition `status`, latest score + summary, source kind, and the **derived** `enriched` (a dossier exists) and `drafted` (a selected draft exists) flags (ADR-0008); and `getProspectDetail(id)` - the prospect plus its latest scoring, selected draft body, and dossier, for the detail view. Reads only; no schema change.
- **Anchor view #3, wired**: a Server Component grid at a real route (browse, filter by status/score, open a detail drawer), graduating the prototype `prospect-list` screen. Server Actions: **enrich** one prospect, **batch-enrich** a multi-selected set, **regenerate** a draft (a forced re-draft), and toggle **auto-enrich**.
- The actions call the existing entry points - `enqueueEnrich` / `enqueueEnrichForProspects` (enrichment), `enqueueDraft(id, true)` (drafting's forced re-draft), `setAutoEnrich` (settings) - so the grid is a thin UI over built capabilities.

Not in scope: the review/approve queue (anchor #2, `review-queue`); sending (D2); new pipeline behavior; the company/content sources. The prototype status-vocabulary reconciliation (ADR-0008) and the enrich-trigger affordances ride along with this screen's wiring (prototype task).

## Capabilities

### New Capabilities
- `prospect-list`: the browse/manage anchor view over every prospect - status, score, source, and the derived enriched/drafted facets - with filtering and a detail view; from here a user triggers enrichment for one prospect or a selected batch, regenerates a draft, and turns auto-enrich on or off.

### Modified Capabilities
<!-- None. A read-model + UI over existing tables and the enrichment/drafting/settings entry points; no capability's requirements change. -->

## Impact

- **New code**: `src/lib/prospect/read.ts` (the `listProspects` / `getProspectDetail` read-model, alongside the existing `load.ts`); a non-prototype app route (`src/app/prospect-list/`) - Server Component page + `'use server'` actions + grid/detail components adapted from the prototype.
- **Reused seams**: `src/lib/db` (reads), `src/lib/enrich` (`enqueueEnrich`/`enqueueEnrichForProspects`, `getSettings`/`setAutoEnrich`), `src/lib/draft` (`enqueueDraft` forced re-draft). No new env var, no migration.
- **Tests**: integration (gated) for `listProspects` (returns each prospect with derived enriched/drafted + latest score) and `getProspectDetail` (the selected draft + dossier). The app route/actions are coverage-excluded (`src/app/**`).
- **D1 note**: the Server Actions are unauthenticated by design (single-user MVP), documented at the route like icp-config.
- **Governed by**: the thesis (anchor view #3), ADR-0008 (enriched/drafted derived from relations, not statuses), ADR-0007 (enrich trigger + auto-enrich), D1 (auth deferred). Architecture home: `docs/product-overview.md` (journey - working from the prospect list); the prototype screen is the design reference.
