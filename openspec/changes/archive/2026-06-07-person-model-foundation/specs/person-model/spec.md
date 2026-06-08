# person-model Specification

## Purpose

The shared identity entity for the CRM: a **Person** the CRM user tracks. This foundation renames the former Prospect to Person and adds the facets and sibling entities the engagement+triage motion needs (`type`, `monitored`, `Company`, `SignalDecision`, type-keyed rubrics), while preserving every existing behavior for a `type = prospect` person. It carries no new user-facing feature on its own - it is the contract the universal-triage, posts/Feed, and comments slices build on.

## Architecture

- Decisions: [ADR-0015](../../../docs/adr/0015-prospect-to-person-with-type.md) (rename + `type`/`monitored`), [ADR-0016](../../../docs/adr/0016-company-first-class-entity.md) (Company), [ADR-0014](../../../docs/adr/0014-signal-decision-separate-from-signal.md) (SignalDecision), [ADR-0017](../../../docs/adr/0017-type-keyed-advisory-rubrics.md) (rubric kind). Origin/identity: [ADR-0010](../../../docs/adr/0010-prospect-origin-signal-or-manual.md) (the `PersonIdentity` seam, unchanged here).
- Data model: the `Person`, `Company`, `SignalDecision` entities and `Rubric.kind` in [domain-model.md](../../../docs/architecture/domain-model.md).

## ADDED Requirements

### Requirement: A Person of type prospect behaves exactly as a Prospect did

After the rename, a `Person` with `type = prospect` SHALL flow through qualification, drafting, enrichment, the review queue, and outcome logging with the same observable behavior as the former Prospect - the same scores, statuses, drafts, and queue membership. The rename SHALL preserve all existing rows and their relationships.

#### Scenario: An existing prospect is unchanged after the rename

- **WHEN** the migration renames `prospects` to `person`
- **THEN** every existing row is preserved as a `type = prospect`, `monitored = false` Person with no company
- **AND** it scores, qualifies, drafts, queues, and logs outcomes exactly as before

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
