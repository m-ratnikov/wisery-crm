# scan-run-history Specification

## Purpose
TBD - created by archiving change scan-run-history. Update Purpose after archive.
## Requirements
### Requirement: View recent scan-run outcomes

The jobs monitor SHALL present a list of recent scan runs read from the recorded scan history, so the CRM user can see what a scan did after its queue has returned to idle. Each listed run SHALL show a human-readable label for the source it scanned, its status (running, completed, or failed), when it ran, and a plain-language summary of its outcome derived from the run's recorded counts (items fetched, signals newly persisted, and items dropped). The summary SHALL distinguish "found new signals", "found only items already seen", and "found nothing" so an empty result is explained rather than left blank. This view is read-only and does not change how scans are recorded.

#### Scenario: A completed scan that persisted new signals

- **WHEN** a scan finishes having fetched items of which some were newly persisted
- **THEN** the run is listed as completed with its source label and a summary stating how many were fetched and how many were new

#### Scenario: A completed scan that found only duplicates

- **WHEN** a scan finishes having fetched items but persisted none because all were already seen
- **THEN** the run is listed as completed with a summary that says no new signals were found and the items were already seen, rather than appearing as a failure or showing nothing

#### Scenario: A completed scan that fetched nothing

- **WHEN** a scan finishes having fetched no items
- **THEN** the run is listed as completed with a summary stating nothing matched, so an empty scan is explained

#### Scenario: A failed scan shows its error

- **WHEN** a scan is recorded as failed
- **THEN** the run is listed as failed with its source label and the recorded error message

#### Scenario: A scan still in progress

- **WHEN** a scan is recorded as running and has not finished
- **THEN** the run is listed as in progress rather than implying a completed outcome

### Requirement: Recent scans refresh with the live view

The recent scan-run list SHALL refresh on the same automatic interval as the live queue view while the monitor is open, so a scan that runs while the user is watching appears (and updates from running to its final outcome) without a manual reload.

#### Scenario: A scan completes while the monitor is open

- **WHEN** the CRM user is watching the monitor and a scan runs to completion
- **THEN** the recent scans list reflects the run and its final outcome within a few seconds without a manual reload

### Requirement: Scan history is read-only and bounded

The recent scan-run view SHALL be observational only and SHALL show a bounded number of the most recent runs rather than the entire history, so the page stays responsive as scan history grows. It SHALL NOT expose controls to re-run, delete, or otherwise mutate a scan or its record.

#### Scenario: History stays bounded as runs accumulate

- **WHEN** many scan runs have been recorded over time
- **THEN** the monitor shows the most recent runs up to its display bound, ordered most-recent first

#### Scenario: No mutation from the scan history view

- **WHEN** the CRM user views the recent scans
- **THEN** no action on the page changes any scan record or re-runs any scan

