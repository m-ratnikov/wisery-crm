# enrichment Specification

## Purpose

The optional, paid deepening step: enrich a person into a single dossier of research through a provider-neutral port (Apify default, fake for tests). Enrichment is an **on-demand action** on the person (single or batch), with an **opt-in auto-enrich setting** reserved for a future auto-enrich-on-approval - never an automatic spend (ADR-0007, ADR-0019). Any admitted person is enrichable; there is no qualification or score gate - the human's triage approval is the gate (ADR-0022). "Enriched" is derived from the one-per-person dossier relation, not a status.

## Architecture

- Decisions: [ADR-0007](../../../docs/adr/0007-user-triggered-optional-enrichment.md) (optional/user-triggered/opt-in-auto), [ADR-0002](../../../docs/adr/0002-headless-browser-scraping.md) (Apify default behind the port, self-host interchangeable), [ADR-0019](../../../docs/adr/0019-generation-and-scoring-on-demand.md) (on-demand actions; the drafting stage retired), [ADR-0022](../../../docs/adr/0022-signal-advisory-is-the-only-score.md) (no person score, no enrichment score-gate), D4 (port/adapter), D10 (PII minimization at the qualify boundary - deferred). Pipeline: [product-overview.md](../../../docs/product-overview.md) section 4.
- Data model: `DOSSIER` (one per person) in [domain-model.md](../../../docs/architecture/domain-model.md); the auto-enrich flag is config-as-data in a single-row settings table.
- Reuses `src/lib/db`, `src/lib/jobs`, and the shared prospect load (`src/lib/prospect`). The post-dossier handoff seam (`enqueueNext`) is currently unwired - the re-draft it once fed was retired with the drafting stage (ADR-0019). The Apify network call is the coverage-excluded seam (needs `APIFY_API_TOKEN`). Triggered from the prospect-list/detail UI; see the [prototype registry](../../../src/app/prototype/README.md).

## Requirements
### Requirement: A person can be deep-enriched into a dossier on demand

The system SHALL deep-enrich a person into a single dossier of research, through a provider-neutral enrichment port so the provider (a managed service or self-host) is an interchangeable adapter. Each person SHALL have at most one dossier; re-enriching a person updates that dossier rather than creating a second. Any admitted person SHALL be enrichable - there is no qualification or score gate, since the human's triage approval already admitted them (ADR-0022).

#### Scenario: Enriching a person produces one dossier

- **WHEN** a person is enriched
- **THEN** a dossier is recorded for it with the enrichment data and the provider that produced it
- **AND** the person has exactly one dossier even if enrichment runs again

### Requirement: Enrichment is an on-demand action, with an opt-in auto setting

The system SHALL make enrichment a user-triggered action - invoked for a single person or a batch of selected people - and SHALL NOT enrich automatically. An auto-enrich setting persists but currently routes nothing; it is reserved for a future auto-enrich-on-approval (ADR-0019). Turning the setting on or off SHALL NOT affect already-enriched people.

#### Scenario: On-demand enrichment of selected people

- **WHEN** a user triggers enrichment for one person or a selected batch
- **THEN** each of those people is enriched

#### Scenario: The auto-enrich setting routes nothing today

- **WHEN** auto-enrich is on and a person is created (by approval or by hand)
- **THEN** no enrichment is enqueued automatically - enrichment is requested only by the explicit single or batch action

