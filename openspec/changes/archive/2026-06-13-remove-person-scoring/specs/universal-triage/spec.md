# universal-triage - delta

Approval creates the entity only. The advisory hint stays on the signal and is never
copied forward into a per-person score (the promotion write from ADR-0019 is removed
along with person scoring itself).

## MODIFIED Requirements

### Requirement: Approval routes a signal by kind into the right entity

On approval the system SHALL create exactly the right entity for the signal's kind in one transaction: a person signal creates a `Person(type = prospect)`; a company signal creates a `Company`; a content signal creates the author as `Person(type = peer)` with the post attached. Approval SHALL NOT record any score against the created entity - the advisory hint remains on the signal, which stays the only scored thing in the system. A dismissed signal SHALL be recorded so a later re-scan of the same item cannot resurface it.

#### Scenario: Approving a person signal

- **WHEN** the CRM user approves a person signal
- **THEN** a `Person(type = prospect)` is created at its pipeline's entry status
- **AND** no score is recorded against the person

#### Scenario: Approving a content signal

- **WHEN** the CRM user approves a standalone-content signal
- **THEN** the post's author is created as `Person(type = peer)` with the post attached

#### Scenario: The advisory hint stays on the signal after approval

- **WHEN** a signal with an advisory hint is approved
- **THEN** the hint remains readable on the signal
- **AND** the created entity carries no copy of it

#### Scenario: A dismissed signal stays dismissed

- **WHEN** the CRM user dismisses a signal and a later scan re-encounters the same item
- **THEN** the signal remains dismissed and does not reappear in the triage lane
