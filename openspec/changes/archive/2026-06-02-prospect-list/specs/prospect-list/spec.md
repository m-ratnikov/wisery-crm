## ADDED Requirements

### Requirement: The prospect list shows every prospect with its pipeline state

The system SHALL present a browse/manage list of all prospects, each with its disposition status, latest score, source, and whether it has been enriched (a dossier exists) and drafted (a selected draft exists). The enriched and drafted facets SHALL be derived from the presence of the dossier and selected draft, not from the status. A user SHALL be able to filter the list (e.g. by status or score) and open a prospect to see its score reasoning, its selected draft, and its dossier.

#### Scenario: The list reflects each prospect's state

- **WHEN** a user opens the prospect list
- **THEN** each prospect is shown with its status, latest score, source, and its derived enriched/drafted facets

#### Scenario: A prospect's detail shows its score, draft, and dossier

- **WHEN** a user opens a prospect's detail
- **THEN** its latest scoring, its selected draft, and its dossier (if any) are shown

### Requirement: The user triggers enrichment and re-drafting from the list

The system SHALL let a user trigger enrichment for a single prospect or for a multi-selected batch, and regenerate a prospect's draft, from the prospect list. These SHALL invoke the existing enrichment and drafting work; the list SHALL reflect the results once they complete.

#### Scenario: Enriching a selected batch

- **WHEN** a user selects several prospects and triggers enrichment
- **THEN** enrichment is requested for each selected prospect

#### Scenario: Regenerating a draft

- **WHEN** a user regenerates a prospect's draft
- **THEN** a new draft is generated and becomes the selected draft

### Requirement: The user controls auto-enrich from the list

The system SHALL let a user turn the auto-enrich setting on or off from the prospect list, and the chosen value SHALL govern whether newly qualified prospects are enriched automatically.

#### Scenario: Toggling auto-enrich

- **WHEN** a user turns auto-enrich on (or off)
- **THEN** the setting is persisted and governs subsequent qualification routing
