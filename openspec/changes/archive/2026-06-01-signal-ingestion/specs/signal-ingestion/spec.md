## ADDED Requirements

### Requirement: Signal sources persist as durable configuration

The system SHALL store each signal source as a durable configuration record - its source type, connector configuration, optional schedule, and enabled state - that survives process restart and is retrievable by identifier. A source SHALL be retired by disabling it rather than by deletion, so that disabling a source erases neither the source nor the scan and signal history it produced.

#### Scenario: Source survives restart

- **WHEN** a CRM user saves a signal source and the application restarts
- **THEN** the source and its configuration are still present and retrievable

#### Scenario: Retiring a source preserves its history

- **WHEN** a CRM user disables a source that has already produced scans and signals
- **THEN** the source is retained in a disabled state and its scan and signal history remain intact

### Requirement: Each scan run is recorded as an independent outcome

The system SHALL record every scan of a source as a durable run carrying its status (running, then completed or failed), its start and finish times, and counts of items fetched, signals persisted, and items dropped. Each scan record SHALL be independent, so that a failed scan is captured with its error without affecting the recorded runs of any other source.

#### Scenario: Completed scan records its counts

- **WHEN** a scan finishes successfully
- **THEN** the scan is recorded as completed with its finish time and its fetched, persisted, and dropped counts

#### Scenario: Failed scan is captured independently

- **WHEN** one source's scan fails
- **THEN** that scan is recorded as failed with its error, and other sources' scan records are unaffected

#### Scenario: A failing source does not stall other sources

- **WHEN** several sources are scanned and one connector raises an error
- **THEN** the other sources' scans still run and record their own outcomes

### Requirement: Signal persistence is idempotent per source

The system SHALL persist a signal at most once per source and dedup key. Re-scanning a source MUST NOT create duplicate signals for items already persisted. Dedup is scoped to the source, so the same dedup key seen under a different source SHALL persist as a separate signal.

#### Scenario: Re-scan creates no duplicates

- **WHEN** a source is scanned again and returns an item already persisted as a signal
- **THEN** no new signal is created and the existing signal is retained unchanged
- **AND** that item is counted as dropped for that scan, not persisted

#### Scenario: Same identity from a different source is distinct

- **WHEN** the same dedup key is produced by a different source
- **THEN** a separate signal is persisted for that source

### Requirement: Every signal traces to its origin and is immutable

Each persisted signal SHALL reference the source and the scan that produced it and SHALL retain its normalized payload and its kind (person, company, or content). Once persisted, a signal's content SHALL NOT be modified, so downstream stages can rely on it as a stable fact.

#### Scenario: Signal resolves to its source and scan

- **WHEN** a signal is read
- **THEN** the source and the specific scan that produced it are resolvable from the signal

#### Scenario: Signal content is stable after persistence

- **WHEN** later scans of the same source run
- **THEN** an already-persisted signal's payload and kind remain unchanged

### Requirement: Sources ingest through one uniform connector contract

The system SHALL ingest every source type through a single connector contract: a connector owns its own fetching and normalization and yields normalized items, and the pipeline applies the same dedup and persistence to those items regardless of source type. Adding a new source type SHALL be the addition of a connector, not a change to the dedup or persistence path. An item that fails the connector's edge validation SHALL NOT be persisted as a signal and SHALL be counted as dropped for that scan, so malformed upstream data never lands as a stored fact.

#### Scenario: A new source type reuses the same dedup and persistence path

- **WHEN** two sources of different types are scanned
- **THEN** both produce signals through the same dedup and persistence behavior, with no source-type-specific persistence logic

#### Scenario: An item that fails edge validation is not persisted

- **WHEN** a connector yields an item that does not satisfy the contract's normalized shape
- **THEN** no signal is persisted for that item
- **AND** it is counted as dropped for that scan rather than recorded as persisted
