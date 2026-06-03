# prospect-list Specification

## Purpose

Anchor view #3: the browse/manage grid over every prospect across the pipeline - status, latest score, source, and the derived enriched/drafted facets (a dossier / a selected draft exists, ADR-0008) - with filtering and a detail view (score reasoning, the selected draft, the dossier). It is the home of the enrich trigger (single + batch) and the auto-enrich toggle (ADR-0007), and of the regenerate-draft action; all are thin Server Actions over the built enrichment/drafting/settings entry points. Read-model + UI, no new schema.

## Architecture

- Decisions: the minimal-interface thesis (anchor view #3), [ADR-0008](../../../docs/adr/0008-prospect-status-is-disposition.md) (enriched/drafted derived from the DOSSIER/DRAFT relations, not statuses), [ADR-0007](../../../docs/adr/0007-user-triggered-optional-enrichment.md) (enrich trigger + auto-enrich), D1 (auth deferred). Journey: working from the prospect list, [product-overview.md](../../../docs/product-overview.md).
- Reads `prospects` / `scorings` / `drafts` / `dossiers` / `signals` / `sources` via the `src/lib/prospect` read-model (`listProspects` / `getProspectDetail`); acts through `src/lib/enrich` (`enqueueEnrich`/`enqueueEnrichForProspects`, `setAutoEnrich`) and `src/lib/draft` (`enqueueDraft` forced re-draft).
- Surfaced at the wired route `src/app/prospect-list/` (grid + `[id]` detail + Server Actions); the prototype screen is the design reference - see the [prototype registry](../../../src/app/prototype/README.md).

## Requirements
### Requirement: The prospect list shows every prospect with its pipeline state

The system SHALL present a browse/manage list of all prospects, each with its disposition status, latest score, source, and whether it has been enriched (a dossier exists) and drafted (a selected draft exists). The enriched and drafted facets SHALL be derived from the presence of the dossier and selected draft, not from the status. A user SHALL be able to filter the list (e.g. by status or score) and open a prospect to see its score reasoning, its selected draft, and its dossier.

#### Scenario: The list reflects each prospect's state

- **WHEN** a user opens the prospect list
- **THEN** each prospect is shown with its status, latest score, source, and its derived enriched/drafted facets

#### Scenario: A prospect's detail shows its score, draft, and dossier

- **WHEN** a user opens a prospect's detail
- **THEN** its latest scoring, its selected draft, and its dossier (if any) are shown

### Requirement: The user triggers enrichment and re-drafting from the list

The system SHALL let a user trigger enrichment for a single prospect or for a multi-selected batch, and regenerate a prospect's draft, from the prospect list. These SHALL invoke the existing enrichment and drafting work; the list SHALL reflect the results once they complete.

#### Scenario: Enriching a selected batch

- **WHEN** a user selects several prospects and triggers enrichment
- **THEN** enrichment is requested for each selected prospect

#### Scenario: Regenerating a draft

- **WHEN** a user regenerates a prospect's draft
- **THEN** a new draft is generated and becomes the selected draft

### Requirement: The user controls auto-enrich from the list

The system SHALL let a user turn the auto-enrich setting on or off from the prospect list, and the chosen value SHALL govern whether newly qualified prospects are enriched automatically.

#### Scenario: Toggling auto-enrich

- **WHEN** a user turns auto-enrich on (or off)
- **THEN** the setting is persisted and governs subsequent qualification routing

