# linkedin-jobs-source Specification

## Purpose

The first real signal source: a connector that ingests LinkedIn job postings as `job`-kind signals at the top of the funnel. A job posting is a new entity the funnel carries; turning it into person prospects (the hiring org's decision-makers) is the deferred normalize-expand step, so this capability lands ingestion and configuration, not expansion.

## Architecture

- Decisions: D4/D8 (a source is an adapter behind the one connector contract; a new source is a new adapter, not a pipeline change) and D3 (signals are the top of funnel). The cost knob (D4): LinkedIn is a hardened target, so a real run goes via the provider or a self-host browser per ADR-0002 - the connector is the seam, the access path is its implementation detail.
- Component home: the `SignalSource` port + registry in [system-design.md](../../../docs/architecture/system-design.md) (C4 L3), the `source-adapters` band. The `job` signal kind is in [domain-model.md](../../../docs/architecture/domain-model.md) (Signal entity).
- Configuration: plugs into the `source-connection` catalog and wizard (the per-kind settings + Zod schema). Routing of the resulting non-person signal is owned by `signal-ingestion` (handoff by kind).

## ADDED Requirements

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
