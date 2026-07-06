# person-model Specification

## Purpose
TBD - created by archiving change person-model-foundation. Update Purpose after archive.
## Requirements
### Requirement: A Person of type prospect behaves exactly as a Prospect did

After the rename, a `Person` with `type = prospect` SHALL behave with the same observable behavior as the former Prospect across the pipeline stages in force at the time of the rename, and SHALL preserve all existing rows and their relationships. (Several of those stages - qualification, drafting, the review queue, and per-person scoring - were retired by later changes, ADR-0019 and ADR-0022; the durable guarantee here is row and relationship preservation under the rename.)

#### Scenario: An existing prospect is unchanged after the rename

- **WHEN** the migration renames `prospects` to `person`
- **THEN** every existing row is preserved as a `type = prospect`, `monitored = false` Person with no company
- **AND** all of its existing relationships are preserved

#### Scenario: The qualifier selects the active ICP rubric by kind

- **WHEN** the qualifier loads the active rubric
- **THEN** it selects the active rubric WHERE `kind = 'icp'`
- **AND** the score is identical to selecting the single active rubric before this change

### Requirement: The engagement entities exist and default to the pre-engagement world

The system SHALL add a `Person.type` (`prospect | peer`, default `prospect`), a `Person.monitored` flag (default false), a nullable `Person.company_id`, a `companies` entity, a `signal_decisions` entity (one decision per signal), and a `Rubric.kind` (`icp | peer | company`, default `icp`) with at most one active rubric per kind. These SHALL be dormant - created with defaults, with no new read or write behavior - until the triage and engagement slices use them.

#### Scenario: New facets and entities are additive

- **WHEN** the foundation migration is applied
- **THEN** existing rows gain `type = prospect`, `monitored = false`, no company, and rubrics gain `kind = 'icp'`, with no backfill
- **AND** the `companies` and `signal_decisions` tables exist and are empty

