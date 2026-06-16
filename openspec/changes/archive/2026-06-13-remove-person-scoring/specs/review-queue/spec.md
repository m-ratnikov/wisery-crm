# review-queue - delta

Scoped strictly to scoring: outcomes lose their score-at-time binding, and the queue
presentation no longer includes a latest score. (This capability has other staleness
relative to the engagement rework - unified Queue, retired drafting - whose true-up is
a separate concern, not this change.)

## MODIFIED Requirements

### Requirement: The queue presents open prospects for review

The system SHALL present the people with open work for human review, each with its working materials (its dossier when one exists, and its engagement artifacts), so the human can judge, act, and log the result. The queue SHALL NOT present a per-person score; the advisory score belongs to the signal in the triage lane.

#### Scenario: A queued person appears with its working materials

- **WHEN** a person has open work
- **THEN** it appears for review with its working materials
- **AND** no per-person score is shown

#### Scenario: An acted person remains visible until its outcome is logged

- **WHEN** a person has been acted on but its outcome is not yet logged
- **THEN** it remains visible so the human can log the outcome

## REMOVED Requirements

### Requirement: Outcomes are logged against the score for the learning loop

**Reason**: There is no per-person score to bind an outcome to; `outcomes.score_at_time` is dropped. The learning loop (D7) will be redesigned around signal advisory scores in a future change.
**Migration**: Outcome logging itself survives (see the added requirement); only the score binding is removed.

## ADDED Requirements

### Requirement: Outcomes are logged for the learning loop

The system SHALL let the human log the outcome of an acted-on person (connected, replied, booked, or no response), recording it against the person and the engagement artifact acted on. The recorded outcome SHALL be retained so the learning loop can be built from real results later (D7, redesigned around signal advisory scores).

#### Scenario: Logging an outcome

- **WHEN** the human logs an outcome for a person they acted on
- **THEN** an outcome is recorded against that person (and the artifact acted on)
- **AND** it is retained for later analysis
