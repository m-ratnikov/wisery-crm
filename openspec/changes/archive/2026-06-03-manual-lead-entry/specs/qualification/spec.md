## ADDED Requirements

### Requirement: Qualification scores a prospect by its person identity regardless of origin

The system SHALL score a prospect against the active rubric using the prospect's person identity - whether that identity comes from its signal (a discovered prospect) or from the prospect's own fields (a manually entered prospect) - through a prospect-keyed qualification entry that operates on an existing prospect. Scoring through this entry SHALL be idempotent per prospect, so re-running qualification for a prospect that already has a score against the active rubric does not create a duplicate score. The existing signal-keyed qualification of a discovered person (which creates the prospect as it scores) is unchanged.

#### Scenario: A manually entered prospect is scored from its own identity

- **WHEN** a manual-origin prospect (no signal) is qualified
- **THEN** it is scored against the active rubric using its entered person identity
- **AND** it transitions to qualified or below_bar by the same gate as a discovered prospect

#### Scenario: Re-qualifying a prospect does not double-score

- **WHEN** qualification is run again for a prospect already scored against the active rubric
- **THEN** no duplicate score is created for that prospect and rubric
