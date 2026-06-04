## ADDED Requirements

### Requirement: A persisted signal is handed off for evaluation by its kind

The system SHALL hand a newly persisted signal off to the qualification stage only when the signal is a person. A non-person signal (`company`, `content`, `job`) SHALL be persisted without a qualification handoff, because qualification scores a person and a non-person signal must first be expanded into people (the normalize-expand stage). This routing SHALL NOT alter the dedup or persistence path, which stays uniform across all kinds; only whether a qualification job is enqueued for the persisted signal depends on kind.

#### Scenario: A person signal is handed off to qualification

- **WHEN** a new `person` signal is persisted
- **THEN** a qualification job is enqueued for it in the same transaction as its insert (unchanged behavior)

#### Scenario: A non-person signal is persisted without a qualification handoff

- **WHEN** a new `job` (or `company` or `content`) signal is persisted
- **THEN** the signal is stored and traceable, and no qualification job is enqueued for it
- **AND** it awaits the normalize-expand stage rather than being scored as a person
