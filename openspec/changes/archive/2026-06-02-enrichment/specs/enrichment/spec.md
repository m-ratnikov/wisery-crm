## ADDED Requirements

### Requirement: A qualified prospect can be deep-enriched into a dossier

The system SHALL deep-enrich a qualified prospect into a single dossier of research, through a provider-neutral enrichment port so the provider (a managed service or self-host) is an interchangeable adapter. Each prospect SHALL have at most one dossier; re-enriching a prospect updates that dossier rather than creating a second. Enrichment SHALL be applied only to a prospect past the score bar, never to a below-bar one.

#### Scenario: Enriching a prospect produces one dossier

- **WHEN** a qualified prospect is enriched
- **THEN** a dossier is recorded for it with the enrichment data and the provider that produced it
- **AND** the prospect has exactly one dossier even if enrichment runs again

#### Scenario: A below-bar prospect is not enriched

- **WHEN** enrichment is requested for a below-bar prospect
- **THEN** no dossier is produced

### Requirement: Enrichment is user-triggered and optional, with opt-in automatic execution

The system SHALL make enrichment user-triggered by default - invoked for a single prospect or a batch of selected prospects - and SHALL NOT enrich automatically unless an explicit auto-enrich setting is enabled. When auto-enrich is on, a newly qualified prospect SHALL be enriched; when off, a newly qualified prospect SHALL be drafted from its signal without enrichment. Turning auto-enrich off SHALL stop new automatic enrichment without affecting already-enriched prospects.

#### Scenario: Manual enrichment of selected prospects

- **WHEN** a user triggers enrichment for one prospect or a selected batch
- **THEN** each of those prospects is enriched

#### Scenario: Auto-enrich routes qualification to enrichment

- **WHEN** auto-enrich is on and a prospect becomes qualified
- **THEN** the prospect is enriched (rather than drafted directly from the signal)

#### Scenario: Auto-enrich off keeps the default path

- **WHEN** auto-enrich is off and a prospect becomes qualified
- **THEN** the prospect is drafted from its signal, with no enrichment

### Requirement: Enrichment grounds a re-draft in the dossier

The system SHALL regenerate the first-touch draft from the dossier once a prospect is enriched, so the message reflects the deeper research rather than only the thin signal. The dossier-grounded draft SHALL become the selected draft, superseding a prior signal-only draft if one exists.

#### Scenario: A re-draft is grounded in the dossier

- **WHEN** a prospect is enriched
- **THEN** a new draft is generated using the dossier and becomes the selected draft
