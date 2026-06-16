# manual-lead-entry Specification

## Purpose
TBD - created by archiving change manual-lead-entry. Update Purpose after archive.
## Requirements
### Requirement: The CRM user adds a lead by hand

The system SHALL let the CRM user add a person to the pipeline manually by entering at least a name (and optionally a headline/title, company, and LinkedIn URL). On submit the system SHALL create a person with manual origin and no signal, persist the entered identity, and place it at its pipeline's entry status. No scoring or qualification step SHALL run or be scheduled for it. A submission without a name SHALL be rejected without creating a person.

#### Scenario: Adding a lead creates a manual person

- **WHEN** the CRM user submits the add-lead form with a name
- **THEN** a person is created with manual origin, no signal, the entered identity, and its pipeline's entry status
- **AND** nothing is enqueued for it

#### Scenario: A nameless lead is rejected

- **WHEN** the add-lead form is submitted without a name
- **THEN** no person is created and the submission is rejected

