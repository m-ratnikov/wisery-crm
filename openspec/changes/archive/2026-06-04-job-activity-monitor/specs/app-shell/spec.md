## ADDED Requirements

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
