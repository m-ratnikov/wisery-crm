# universal-triage Specification

## Purpose

Putting the CRM user in control of what enters the CRM: every persisted signal waits in a triage inbox with an advisory fit hint, and the user approves it into the right entity or dismisses it. This replaces the auto-fan-out-then-auto-gate intake - broad and noisy sources, and peers, can now feed the funnel without flooding it.

## Architecture

- Decisions: [ADR-0013](../../../docs/adr/0013-universal-triage-intake.md) (universal triage, refines ADR-0005 trigger), [ADR-0014](../../../docs/adr/0014-signal-decision-separate-from-signal.md) (SignalDecision), [ADR-0017](../../../docs/adr/0017-type-keyed-advisory-rubrics.md) (advisory rubrics), [ADR-0009](../../../docs/adr/0009-atomic-enqueue-handoff.md) (atomic approval handoff), [ADR-0016](../../../docs/adr/0016-company-first-class-entity.md) (Company), [ADR-0018](../../../docs/adr/0018-engagement-artifacts-post-comment.md) (content -> Post).
- Spine: D11 in [product-overview.md](../../../docs/product-overview.md); the scan-to-triage flow in [system-design.md](../../../docs/architecture/system-design.md).
- Surface: the Queue triage lane; see the [prototype registry](../../../src/app/prototype/README.md).

## ADDED Requirements

### Requirement: Every signal awaits a human triage decision

The system SHALL NOT create any entity from a persisted signal until the CRM user approves it - there is no per-source bypass. Each pending signal SHALL be shown in the Queue's triage lane annotated with an advisory fit hint (the rubric matching its intent), and the advisory hint SHALL NOT be recorded as a durable score.

#### Scenario: A persisted signal waits for triage

- **WHEN** a new signal is persisted
- **THEN** no Person, Company, or Post is created
- **AND** the signal appears in the triage lane with an advisory hint

#### Scenario: The advisory hint is not a durable score

- **WHEN** the advisory filter scores a pending signal
- **THEN** the hint is shown at triage
- **AND** no Scoring row is written for it

### Requirement: Approval routes a signal by kind into the right entity

On approval the system SHALL create exactly the right entity for the signal's kind in one transaction: a person signal creates a `Person(type = prospect)` and enqueues qualification; a company signal creates a `Company`; a content signal creates the author as `Person(type = peer)` with the post attached. A dismissed signal SHALL be recorded so a later re-scan of the same item cannot resurface it.

#### Scenario: Approving a person signal

- **WHEN** the CRM user approves a person signal
- **THEN** a `Person(type = prospect)` is created and qualification is enqueued for it

#### Scenario: Approving a content signal

- **WHEN** the CRM user approves a standalone-content signal
- **THEN** the post's author is created as `Person(type = peer)` with the post attached

#### Scenario: A dismissed signal stays dismissed

- **WHEN** the CRM user dismisses a signal and a later scan re-encounters the same item
- **THEN** the signal remains dismissed and does not reappear in the triage lane
