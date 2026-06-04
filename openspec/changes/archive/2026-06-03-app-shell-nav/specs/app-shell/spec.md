# app-shell Specification

## Purpose

The wired application shell: the persistent navigation chrome that wraps the anchor views so the daily loop is navigable from anywhere. The product commits to a minimal interface (anchor views + generative output); this is the connective tissue between those views - a sidebar reachable on every page, current-location indication, and the per-tenant Settings surface. It graduates the prototype shell into the wired app without adding domain behavior.

## Architecture

- Thesis and anchor views: [product-overview.md](../../../docs/product-overview.md) sections 2 (minimal interface) and the primary journey (configure, list, queue order). The shell carries navigation between the three anchor views; it is not itself an anchor view.
- Component home: the Web / RSC surface in [system-design.md](../../../docs/architecture/system-design.md) (C4 L3). The shell is a Server Component layout over the existing route handlers / anchor-view pages; no new seam.
- Settings: the Settings screen edits the per-tenant `settings` row via the existing `src/lib/enrich/settings.ts` seam; the auto-enrich flag is governed by [ADR-0007](../../../docs/adr/0007-user-triggered-optional-enrichment.md). `tenant_id` keys this per tenant when productized (D1).
- Provenance: graduates the prototype `(app)` shell and settings screen under [src/app/prototype/](../../../src/app/prototype/README.md) (the registry is the screen-to-capability join table); the `/prototype` routes keep their own mock shell.

## ADDED Requirements

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
