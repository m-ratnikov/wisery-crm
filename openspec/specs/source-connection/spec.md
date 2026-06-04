# source-connection Specification

## Purpose
TBD - created by archiving change source-connection-wizard. Update Purpose after archive.
## Requirements
### Requirement: Each source kind declares its connectable settings

The system SHALL let each registered source kind declare the settings it needs to be connected: a human-readable label, the set of configurable fields (each with enough description to render and label an input), and the validation rule for a complete configuration. The settings a CRM user is asked for SHALL be those the chosen kind declares, not a single generic shape shared across all kinds.

#### Scenario: The wizard presents a kind's own fields

- **WHEN** the CRM user chooses a source kind to connect
- **THEN** the settings form presents exactly the fields that kind declares (for example, a search query field for a kind that scans by query)

#### Scenario: Only connectable kinds are offered

- **WHEN** the CRM user opens the connection wizard
- **THEN** only source kinds whose connector is registered (and can therefore be scanned) are offered
- **AND** a kind with no registered connector is not connectable

### Requirement: The user connects a source through a guided wizard

The system SHALL let the CRM user connect a new signal source through a guided flow: choose the source kind, fill that kind's settings, and confirm. On confirmation the source SHALL be persisted as durable configuration (its kind, the entered settings, enabled), so it can then be scanned. The flow SHALL replace any single flat add-source form, so connecting a source is always kind-aware.

#### Scenario: Connecting a source

- **WHEN** the CRM user completes the wizard for a chosen kind with valid settings
- **THEN** a source of that kind is created with the entered settings and appears in the source list, ready to scan

#### Scenario: Abandoning the wizard creates nothing

- **WHEN** the CRM user starts the wizard but does not confirm
- **THEN** no source is created

### Requirement: A connected source's settings can be edited

The system SHALL let the CRM user edit a connected source's settings through the same per-kind form, and SHALL persist a valid edit as a configuration update on the existing source. Editing settings SHALL NOT delete and recreate the source, so the source keeps its identity and its scan and signal history.

#### Scenario: Editing settings updates the source in place

- **WHEN** the CRM user edits a connected source's settings and saves a valid configuration
- **THEN** the source's configuration is updated in place and its prior scans and signals remain intact

### Requirement: Source configuration is validated against its kind

The system SHALL validate a source's configuration against the chosen kind's declared validation rule on both connect and edit, and SHALL reject a configuration that does not satisfy it without persisting. This validation SHALL hold even when the request does not come from the wizard (for example a direct form post), so an unusable source configuration is never stored.

#### Scenario: Invalid configuration is rejected

- **WHEN** a request attempts to connect or edit a source with settings that do not satisfy the kind's validation rule
- **THEN** the configuration is rejected and no source is created or updated

#### Scenario: A configuration for an unregistered kind is rejected

- **WHEN** a request attempts to connect a source whose kind has no registered connector
- **THEN** the request is rejected and no source is created

