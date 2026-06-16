# prospect-list - delta

The list and detail lose the person score, the qualification badge, the score filter,
and the re-qualify affordance. People are presented by identity, pipeline status,
source, and facets. (Mentions of the latest score in the canonical text date from the
pre-rework model; this delta removes them along with the scoring itself.)

## MODIFIED Requirements

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

### Requirement: Manual-origin prospects appear alongside discovered ones

The system SHALL show a manual-origin person in the prospect list with the same identity and pipeline status fields as a discovered person, so the CRM user works one list regardless of origin. Including manual people SHALL NOT drop or alter how discovered people appear.

#### Scenario: A manual prospect appears in the list

- **WHEN** a manual person exists
- **THEN** it appears in the prospect list with its entered identity and its pipeline status

#### Scenario: Discovered prospects are unaffected

- **WHEN** the prospect list is shown with both discovered and manual people
- **THEN** each discovered person appears exactly as before, and manual people appear alongside them

## REMOVED Requirements

### Requirement: The prospect list offers add-lead and re-qualify affordances

**Reason**: The re-qualify affordance is deleted with person scoring; the add-lead half survives as its own requirement (added below).
**Migration**: Use the add-lead affordance; there is no scoring step to re-trigger.

## ADDED Requirements

### Requirement: The prospect list offers an add-lead affordance

The system SHALL present, on the prospect list, an affordance to add a lead by hand that opens the manual-entry form.

#### Scenario: Add-lead affordance is present

- **WHEN** the CRM user views the prospect list
- **THEN** an add-lead affordance is available that opens the manual-entry form
