## MODIFIED Requirements

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
