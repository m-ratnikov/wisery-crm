## 1. The read-model

- [x] 1.1 Create `src/lib/prospect/read.ts` (`server-only`) `listProspects()`: base query `prospects` innerJoin `signals` innerJoin `sources` ordered newest-first; compose the latest scoring per prospect, the dossier-exists set, and the selected-draft-exists set; return `ProspectListItem[]` (`id, status, score, summary, sourceKind, name, enriched, drafted, createdAt`) with enriched/drafted derived from the relations (D-A, D-B)
- [x] 1.2 Add `getProspectDetail(prospectId)`: the prospect + its latest scoring + its selected draft body + its dossier (or null); `name` extracted best-effort from the signal payload (D-A, D-C)

## 2. The wired anchor view

- [x] 2.1 Create the route `src/app/prospect-list/page.tsx` (Server Component): render the grid from `listProspects()` with status/score filtering and a detail drawer from `getProspectDetail()`; adapt the prototype's grid/drawer components (D-D)
- [x] 2.2 Create `src/app/prospect-list/actions.ts` (`'use server'`): `enrichAction`, `batchEnrichAction`, `regenerateDraftAction` (forced re-draft), `setAutoEnrichAction` - wire to `src/lib/enrich` / `src/lib/draft` entry points and `revalidatePath` (D-D); add the D1 auth-deferred note (D-E)

## 3. Tests

- [x] 3.1 Integration test (gated): `listProspects()` returns a qualified+enriched+drafted prospect with the correct status, latest score, source kind, and `enriched`/`drafted` both true; a bare qualified prospect shows them false
- [x] 3.2 Integration test: `getProspectDetail()` returns the latest scoring, the selected draft body, and the dossier for an enriched+drafted prospect

## 4. Verify, registry, archive

- [x] 4.1 Cover `src/lib/prospect/read.ts` via the integration tests; the `src/app/**` route + actions are coverage-excluded
- [x] 4.2 Update `src/app/prototype/README.md`: mark the `prospect-list` screen graduated to the wired anchor view; note the status-vocabulary reconciliation (ADR-0008) belongs to the prototype task
- [x] 4.3 Run `npm run verify` green against a reachable test Postgres
- [x] 4.4 Re-review the delta in context (READ-ONLY agent) per the looping rule, then `/opsx:verify` and archive
