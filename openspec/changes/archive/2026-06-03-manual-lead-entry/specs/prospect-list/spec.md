## ADDED Requirements

### Requirement: Manual-origin prospects appear alongside discovered ones

The system SHALL show a manual-origin prospect in the prospect list - and, once it is queued, in the review queue - with the same identity, score, and status fields as a discovered prospect, so the CRM user works one list regardless of origin. Including manual prospects SHALL NOT drop or alter how discovered prospects appear.

#### Scenario: A manual prospect appears in the list

- **WHEN** a manual prospect exists
- **THEN** it appears in the prospect list with its entered identity and, once scored, its score and status

#### Scenario: Discovered prospects are unaffected

- **WHEN** the prospect list is shown with both discovered and manual prospects
- **THEN** each discovered prospect appears exactly as before, and manual prospects appear alongside them

### Requirement: The prospect list offers add-lead and re-qualify affordances

The system SHALL present, on the prospect list, an affordance to add a lead by hand and - for a manual prospect still unscored - an affordance to re-qualify it.

#### Scenario: Add-lead affordance is present

- **WHEN** the CRM user views the prospect list
- **THEN** an add-lead affordance is available that opens the manual-entry form
