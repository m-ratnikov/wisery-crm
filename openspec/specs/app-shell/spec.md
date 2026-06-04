# app-shell Specification

## Purpose
TBD - created by archiving change app-shell-nav. Update Purpose after archive.
## Requirements
### Requirement: Persistent navigation across the wired app

The system SHALL present a persistent navigation sidebar on every wired application page - the home view and each anchor view (ICP & source config, prospect list and its detail, review queue) and the settings screen. The sidebar SHALL link to home and to each of the three anchor views, ordered as the daily loop runs (configure, then list, then queue), and to the settings screen.

#### Scenario: Navigating between anchor views

- **WHEN** the CRM user is on any wired page (including a sub-page such as a prospect detail)
- **THEN** the sidebar is present with links to home, the three anchor views, and settings
- **AND** selecting any link navigates to that destination without returning to the home grid first

#### Scenario: Returning home from a sub-page

- **WHEN** the CRM user is on a prospect detail page
- **THEN** a home link is available in the sidebar that returns them to the home view

### Requirement: Current location is indicated

The system SHALL indicate which navigation destination corresponds to the page currently shown, so the CRM user can tell where they are in the app.

#### Scenario: Active route is highlighted

- **WHEN** the CRM user is viewing the prospect list
- **THEN** the prospect-list navigation item is shown as active
- **AND** the other navigation items are shown as inactive

### Requirement: Settings screen edits per-tenant settings

The system SHALL provide a settings screen, reachable from the sidebar, that reads and edits the per-tenant application settings. It SHALL surface the auto-enrich flag (ADR-0007): showing its current value and letting the CRM user turn it on or off, with the change persisted to the single settings row.

#### Scenario: Viewing the current auto-enrich setting

- **WHEN** the CRM user opens the settings screen
- **THEN** the current auto-enrich value is shown

#### Scenario: Changing the auto-enrich setting

- **WHEN** the CRM user toggles auto-enrich and saves
- **THEN** the new value is persisted to the settings row
- **AND** reopening the settings screen shows the updated value

### Requirement: The prototype shell is unaffected

The wired shell SHALL be separate from the prototype mock shell. Changes to the wired navigation SHALL NOT alter the `/prototype` route tree, which keeps its own mock shell and mock data.

#### Scenario: Prototype routes keep their own shell

- **WHEN** the CRM user navigates to a `/prototype` route
- **THEN** the prototype mock shell renders as before, independent of the wired shell

### Requirement: Operations navigation section

The persistent sidebar SHALL present an operations section, visually distinct from the anchor-view group, that links to the background-jobs monitor. The monitor is an observability view, not a high-judgment anchor view, so it SHALL NOT appear within the three anchor-view links.

#### Scenario: Reaching the jobs monitor from the sidebar

- **WHEN** the CRM user is on any wired page
- **THEN** the sidebar shows an operations section with a link to the jobs monitor
- **AND** that link is outside the anchor-view group
- **AND** selecting it navigates to the jobs monitor

#### Scenario: The monitor link reflects the current location

- **WHEN** the CRM user is viewing the jobs monitor
- **THEN** the operations jobs-monitor item is shown as active
- **AND** the anchor-view items are shown as inactive

