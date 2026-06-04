# manual-lead-entry Specification

## Purpose

Letting the CRM user put a known person under evaluation by hand - a referral, an event contact, a name from a call - with no upstream signal. The manual lead is a first-class prospect (origin = manual, ADR-0010) that flows through the same qualify gate and pipeline as a discovered one.

## Architecture

- Decision: [ADR-0010](../../../docs/adr/0010-prospect-origin-signal-or-manual.md) (a prospect originates from a signal or manually; `signal_id` nullable; per-origin CHECK; `PersonIdentity` seam). Enqueue: [ADR-0009](../../../docs/adr/0009-atomic-enqueue-handoff.md) (the manual add is a user-triggered, fire-and-forget enqueue, not the atomic handoff).
- Data model: the `Prospect` `origin` and the manual identity columns in [domain-model.md](../../../docs/architecture/domain-model.md); the lifecycle's manual entry. Pipeline / MVP scope: [product-overview.md](../../../docs/product-overview.md).
- Surface: the prospect-list anchor view; see the [prototype registry](../../../src/app/prototype/README.md).

## ADDED Requirements

### Requirement: The CRM user adds a lead by hand

The system SHALL let the CRM user add a person to the pipeline manually by entering at least a name (and optionally a headline/title, company, and LinkedIn URL). On submit the system SHALL create a prospect with manual origin and no signal, persist the entered identity, and enqueue it for qualification. A submission without a name SHALL be rejected without creating a prospect.

#### Scenario: Adding a lead creates a manual prospect

- **WHEN** the CRM user submits the add-lead form with a name
- **THEN** a prospect is created with manual origin, no signal, the entered identity, and status `new`
- **AND** qualification is enqueued for it

#### Scenario: A nameless lead is rejected

- **WHEN** the add-lead form is submitted without a name
- **THEN** no prospect is created and the submission is rejected

### Requirement: A manual lead can be re-qualified after a failed enqueue

Because the qualification enqueue for a manual add is fire-and-forget (ADR-0009), the system SHALL let the CRM user re-trigger qualification for a manual prospect that is still unscored (in `new`), so a failed enqueue is recoverable without re-entering the lead.

#### Scenario: Re-qualifying a stuck manual prospect

- **WHEN** the CRM user re-qualifies a manual prospect that is still in `new`
- **THEN** qualification is enqueued for that prospect
