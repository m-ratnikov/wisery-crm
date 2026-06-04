# icp-config Specification

## Purpose

The ICP rubric the qualifier scores against and the user profile the drafter writes from, kept as versioned config-as-data the engine reads, never hardcoded (D6, D1). Exactly one rubric is active; edits are additive new versions so a rubric a past score was taken against is never rewritten (the learning-loop invariant). A starter ICP is seeded so the pipeline can run before hand-entry. The wired config anchor view (anchor #1) is where the user edits the rubric and profile and manages and scans sources.

## Architecture

- Journey + decisions: [product-overview.md](../../../docs/product-overview.md) journey step 1 and the qualifier (section 5); D6 (rubric as config-as-data), D1 (config-as-data the one kept multi-tenant discipline; auth deferred).
- Data model: `Rubric` and `USER_PROFILE` in [domain-model.md](../../../docs/architecture/domain-model.md), including the "a Rubric is immutable once any Scoring references it" invariant realized here as additive versioning.
- Surfaced by the wired anchor view at `src/app/icp-config/` (Server Component + Server Actions over `src/lib/icp`); the design reference is the prototype screen in the [prototype registry](../../../src/app/prototype/README.md). Reuses `signal-ingestion`'s sources + `enqueueScan`.
## Requirements
### Requirement: The ICP rubric and user profile persist as config-as-data

The system SHALL store the ICP scoring rubric and the user profile as durable configuration the engine reads, never hardcoded in a prompt or in logic. Both SHALL survive process restart and be retrievable, so the qualifier and the drafter read the user's criteria and voice from data.

#### Scenario: Rubric and profile survive restart

- **WHEN** a user saves an ICP rubric and a profile and the application restarts
- **THEN** the rubric and profile are still present and retrievable as the active configuration

### Requirement: Exactly one rubric is active

The system SHALL keep exactly one rubric active at a time, and SHALL return that active rubric as the one the qualifier scores against. Activating a rubric SHALL deactivate the previously active one.

#### Scenario: Reading the active rubric

- **WHEN** the engine requests the rubric to score against
- **THEN** it receives the single currently-active rubric

#### Scenario: Saving a rubric makes it the active one

- **WHEN** a user saves a new rubric
- **THEN** it becomes the active rubric and the previously active rubric is no longer active

### Requirement: Editing configuration is additive, never destructive

The system SHALL record a configuration edit as a new version rather than overwriting the existing one, so that a rubric a past score was taken against is never rewritten. A previously saved rubric or profile version SHALL remain intact after a later edit.

#### Scenario: Editing a rubric preserves the prior version

- **WHEN** a user edits and saves the rubric
- **THEN** a new rubric version becomes active
- **AND** the previously saved rubric version is retained unchanged

#### Scenario: Editing the profile preserves the prior version

- **WHEN** a user edits and saves the profile
- **THEN** the latest profile is returned to readers
- **AND** the previously saved profile version is retained unchanged

### Requirement: A starter configuration is available without hand-entry

The system SHALL provide an initial active rubric and profile so the pipeline can run before a user hand-enters configuration, and seeding SHALL be idempotent so running it when configuration already exists changes nothing.

#### Scenario: Seeding provides an active rubric

- **WHEN** the starter configuration is seeded into an empty system
- **THEN** an active rubric and a profile are present and retrievable

#### Scenario: Re-seeding is a no-op

- **WHEN** the starter configuration is seeded again after configuration already exists
- **THEN** no duplicate or replacement configuration is created and the existing configuration is unchanged

### Requirement: The user configures the engine from the config screen

The system SHALL present a config screen where a user views and edits the active rubric and the profile, and manages their signal sources - connecting a new source through the guided per-kind wizard, editing a connected source's settings, enabling or disabling it, and triggering a scan. Saving an edit SHALL persist it through the config-as-data layer and the updated configuration SHALL be reflected on the screen.

#### Scenario: Editing the rubric from the screen persists it

- **WHEN** a user edits the rubric on the config screen and saves
- **THEN** the edit is persisted as the new active rubric and the screen reflects it

#### Scenario: Triggering a scan from the screen

- **WHEN** a user triggers a scan of an enabled source from the config screen
- **THEN** a scan is enqueued for that source

#### Scenario: Connecting a source from the screen

- **WHEN** a user connects a new source from the config screen through the guided wizard
- **THEN** the source is created with its kind's settings and appears in the source list, ready to scan

#### Scenario: Editing a connected source's settings from the screen

- **WHEN** a user edits a connected source's settings on the config screen and saves a valid configuration
- **THEN** the configuration is updated in place and the screen reflects it

