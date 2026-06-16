# universal-triage Specification

## Purpose
TBD - created by archiving change universal-triage. Update Purpose after archive.
## Requirements
### Requirement: Every signal awaits a human triage decision

The system SHALL NOT create any entity from a persisted signal until the CRM user approves it - there is no per-source bypass. Each pending signal SHALL be shown in the Queue's triage lane annotated with an advisory fit hint (the rubric matching its intent), and the advisory hint SHALL NOT be recorded as a durable score.

#### Scenario: A persisted signal waits for triage

- **WHEN** a new signal is persisted
- **THEN** no Person, Company, or Post is created
- **AND** the signal appears in the triage lane with an advisory hint

#### Scenario: The advisory hint is not a durable score

- **WHEN** the advisory filter scores a pending signal
- **THEN** the hint is shown at triage
- **AND** no Scoring row is written for it

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

