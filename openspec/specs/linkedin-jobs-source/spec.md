# linkedin-jobs-source Specification

## Purpose
TBD - created by archiving change linkedin-jobs-source. Update Purpose after archive.
## Requirements
### Requirement: LinkedIn job postings are ingested as job signals

The system SHALL provide a LinkedIn jobs connector that, given a configured search, fetches job postings and persists each new posting as a `job`-kind signal carrying a stable dedup key and a payload of the posting's identifying fields (such as title, company, location, url). Re-scanning a posting already ingested SHALL NOT create a duplicate signal (per-source dedup, unchanged).

#### Scenario: A scan ingests new postings as job signals

- **WHEN** a configured LinkedIn jobs source is scanned and the connector yields postings
- **THEN** each new posting is persisted as a `job`-kind signal traceable to its source and scan

#### Scenario: Re-scanning a posting is deduped

- **WHEN** a posting already ingested is yielded again on a later scan
- **THEN** no duplicate signal is persisted and it is counted as dropped for that scan

### Requirement: A LinkedIn jobs source is configurable through the wizard

The system SHALL let the CRM user connect and configure a LinkedIn jobs source through the guided connection wizard, specifying its search settings - keywords (required) and optionally a location and a posted-within window - validated against the kind's schema before the source is created.

#### Scenario: Connecting a LinkedIn jobs source

- **WHEN** the CRM user completes the wizard for the LinkedIn jobs kind with valid search settings
- **THEN** a LinkedIn jobs source is created with those settings and is ready to scan

