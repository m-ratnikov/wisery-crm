## ADDED Requirements

### Requirement: A signal fans out to person prospects

The system SHALL turn a persisted Signal into the person prospect(s) worth evaluating: a person-yielding signal produces exactly one prospect, and the signal-to-prospect relationship SHALL be one-to-many so a single signal can later expand into many prospects without a schema change. Each prospect SHALL reference the signal it came from, and the score SHALL be recorded against the prospect, never on the shared signal.

#### Scenario: A person signal yields one prospect

- **WHEN** a person signal is qualified
- **THEN** exactly one prospect is created referencing that signal

#### Scenario: The score is a property of the prospect

- **WHEN** a prospect is scored
- **THEN** the score is recorded against that prospect, and the signal carries no score

### Requirement: Each prospect is scored 1-5 against the active rubric

The system SHALL score each prospect from 1 to 5 against the active ICP rubric read as configuration, recording a reason and summary. The rubric SHALL be read as config-as-data, never hardcoded. When the available data is too thin to judge responsibly, the system SHALL record an insufficient-data result (a score of -1) rather than guess.

#### Scenario: A prospect is scored against the active rubric

- **WHEN** a prospect is qualified and an active rubric exists
- **THEN** a score from 1 to 5 is recorded for it with a reason and a summary, judged against the active rubric's criteria

#### Scenario: Thin data yields insufficient-data, not a guess

- **WHEN** a prospect's signal is too thin to judge responsibly
- **THEN** an insufficient-data result (score -1) is recorded rather than a fabricated score

### Requirement: The score gate decides what flows downstream

The system SHALL gate prospects on their latest score against the active rubric: a score of 3 or higher qualifies the prospect for downstream processing, and a score below 3 (or insufficient-data) marks the prospect below-bar. Below-bar prospects SHALL be retained, not deleted, so the learning loop can use them later, but SHALL NOT be surfaced as actionable.

#### Scenario: A 3-or-higher score qualifies the prospect

- **WHEN** a prospect scores 3 or higher
- **THEN** it is marked qualified and eligible for downstream processing

#### Scenario: A below-bar score is retained but not surfaced

- **WHEN** a prospect scores below 3 or insufficient-data
- **THEN** it is marked below-bar and retained, and is not surfaced as an actionable prospect

### Requirement: Every score is recorded for outcome-bound learning

The system SHALL record, with each score, the rubric version, the prompt version, and the model that produced it, so that a later outcome can bind to the exact score and rubric a prospect was acted on. Scoring SHALL be additive: re-scoring a prospect records a new scoring rather than overwriting the prior one.

#### Scenario: A score carries its rubric, prompt, and model versions

- **WHEN** a prospect is scored
- **THEN** the recorded score includes the rubric version, prompt version, and model used

#### Scenario: Re-scoring is additive

- **WHEN** a prospect is scored again
- **THEN** a new scoring is recorded and the previous scoring is retained

### Requirement: A newly persisted signal is queued for qualification

The system SHALL enqueue qualification for each newly persisted Signal, so a scan that lands new signals leads to those signals being scored without a manual step. A signal that was already persisted (a re-scan duplicate) SHALL NOT be re-qualified, so re-scanning a source does not re-score existing prospects.

#### Scenario: New signals are qualified after a scan

- **WHEN** a scan persists new signals
- **THEN** qualification is enqueued for each newly persisted signal

#### Scenario: Re-scan does not re-qualify

- **WHEN** a re-scan produces only duplicate signals that were already persisted
- **THEN** no new qualification work is enqueued for them
