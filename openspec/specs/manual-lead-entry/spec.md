# manual-lead-entry Specification

## Purpose
TBD - created by archiving change manual-lead-entry. Update Purpose after archive.
## Requirements
### Requirement: The CRM user adds a lead by hand

The system SHALL let the CRM user add a person to the pipeline manually by entering at least a name (and optionally a headline/title, company, and LinkedIn URL). On submit the system SHALL create a prospect with manual origin and no signal, persist the entered identity, and enqueue it for qualification. A submission without a name SHALL be rejected without creating a prospect.

#### Scenario: Adding a lead creates a manual prospect

- **WHEN** the CRM user submits the add-lead form with a name
- **THEN** a prospect is created with manual origin, no signal, the entered identity, and status `new`
- **AND** qualification is enqueued for it

#### Scenario: A nameless lead is rejected

- **WHEN** the add-lead form is submitted without a name
- **THEN** no prospect is created and the submission is rejected

### Requirement: A manual lead can be re-qualified after a failed enqueue

Because the qualification enqueue for a manual add is fire-and-forget (ADR-0009), the system SHALL let the CRM user re-trigger qualification for a manual prospect that is still unscored (in `new`), so a failed enqueue is recoverable without re-entering the lead.

#### Scenario: Re-qualifying a stuck manual prospect

- **WHEN** the CRM user re-qualifies a manual prospect that is still in `new`
- **THEN** qualification is enqueued for that prospect

