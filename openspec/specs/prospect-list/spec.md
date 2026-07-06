# prospect-list Specification

## Purpose

Anchor view #3: the browse/manage grid over every person across the pipeline - pipeline status, source, and the derived enriched facet (a dossier exists) - with filtering and a detail view (the dossier). No per-person score or qualification verdict is shown; the advisory score lives on the originating signal in the triage lane (ADR-0022). It is the home of the enrich trigger (single + batch) and the auto-enrich toggle (ADR-0007); both are thin Server Actions over the built enrichment/settings entry points. Read-model + UI, no new schema.

## Architecture

- Decisions: the minimal-interface thesis (anchor view #3), [ADR-0020](../../../docs/adr/0020-configurable-pipelines-for-person-status.md) (pipeline status), [ADR-0022](../../../docs/adr/0022-signal-advisory-is-the-only-score.md) (no per-person score; enriched derived from the DOSSIER relation), [ADR-0007](../../../docs/adr/0007-user-triggered-optional-enrichment.md) (enrich trigger + auto-enrich), [ADR-0019](../../../docs/adr/0019-generation-and-scoring-on-demand.md) (drafting retired), D1 (auth deferred). Journey: working from the prospect list, [product-overview.md](../../../docs/product-overview.md).
- Reads `person` / `dossiers` / `signals` / `sources` via the `src/lib/prospect` read-model (`listProspects` / `getProspectDetail`); acts through `src/lib/enrich` (`enqueueEnrich`/`enqueueEnrichForProspects`, `setAutoEnrich`).
- Surfaced at the wired route `src/app/prospect-list/` (grid + `[id]` detail + Server Actions); the prototype screen is the design reference - see the [prototype registry](../../../src/app/prototype/README.md).
## Requirements
### Requirement: The prospect list shows every prospect with its pipeline state

The system SHALL present a browse/manage list of all people, each with its identity, its pipeline status, its source, and whether it has been enriched (a dossier exists). The enriched facet SHALL be derived from the presence of the dossier, not from the status. A user SHALL be able to filter the list (e.g. by pipeline status) and open a person to see its detail, including its dossier when one exists. The list and detail SHALL NOT present a per-person score or a qualification verdict - the advisory score lives on the originating signal, in the triage lane where the judgment happened.

#### Scenario: The list reflects each person's state

- **WHEN** a user opens the prospect list
- **THEN** each person is shown with its identity, pipeline status, source, and its derived enriched facet
- **AND** no score column or qualification badge is shown

#### Scenario: A person's detail carries no score

- **WHEN** a user opens a person's detail
- **THEN** its identity, pipeline status, and dossier (if any) are shown
- **AND** no score, score reasoning, or qualification verdict appears

### Requirement: The user triggers enrichment from the list

The system SHALL let a user trigger enrichment for a single person or for a multi-selected batch from the prospect list. This SHALL invoke the existing enrichment work; the list SHALL reflect the results once they complete.

#### Scenario: Enriching a selected batch

- **WHEN** a user selects several people and triggers enrichment
- **THEN** enrichment is requested for each selected person

### Requirement: The user controls auto-enrich from the list

The system SHALL let a user turn the auto-enrich setting on or off from the prospect list, and SHALL persist the chosen value. The setting does NOT currently route any enrichment - the qualification trigger it once governed no longer exists (ADR-0019, ADR-0022) - and it is reserved for a future auto-enrich-on-approval (auto-enqueueing enrichment when the user approves a signal). Enrichment today is triggered only by the explicit single and batch actions.

#### Scenario: Toggling auto-enrich persists the setting

- **WHEN** a user turns auto-enrich on (or off)
- **THEN** the setting is persisted

#### Scenario: The setting routes no enrichment today

- **WHEN** auto-enrich is on and a person is created (by approval or by hand)
- **THEN** no enrichment is enqueued automatically - enrichment is requested only by the explicit single or batch action

### Requirement: Manual-origin prospects appear alongside discovered ones

The system SHALL show a manual-origin person in the prospect list with the same identity and pipeline status fields as a discovered person, so the CRM user works one list regardless of origin. Including manual people SHALL NOT drop or alter how discovered people appear.

#### Scenario: A manual prospect appears in the list

- **WHEN** a manual person exists
- **THEN** it appears in the prospect list with its entered identity and its pipeline status

#### Scenario: Discovered prospects are unaffected

- **WHEN** the prospect list is shown with both discovered and manual people
- **THEN** each discovered person appears exactly as before, and manual people appear alongside them

### Requirement: The prospect list offers an add-lead affordance

The system SHALL present, on the prospect list, an affordance to add a lead by hand that opens the manual-entry form.

#### Scenario: Add-lead affordance is present

- **WHEN** the CRM user views the prospect list
- **THEN** an add-lead affordance is available that opens the manual-entry form

