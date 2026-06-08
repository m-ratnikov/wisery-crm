# ADR-0016: Company is a first-class entity

- Status: accepted
- Date: 2026-06-06
- Supersedes: none
- Source: docs/explore/2026-06-06-content-marketing-engagement.md; domain-model.md

## Context

A company exists today only as a transient thing a company/content signal expands into people; there is no stored company entity, and the expansion record is explicitly not modeled yet. Universal triage (ADR-0013) lets the CRM user approve a company signal as a decision in its own right, which must create something durable. Approving a company into nothing (or forcing immediate expansion to people) would lose the company as a tracked record and couple approval to the deferred expansion job.

## Decision

We will add a first-class `companies` entity created when a company signal is approved. It carries firmographic identity (name, optional domain, optional LinkedIn URL, provider-shaped firmographics JSONB) and a nullable `signal_id` recording the signal it was approved from. A `Person` gains a nullable `company_id` FK so people can later link to a company. The company-to-people expansion job that populates it stays out of scope (deferred), but the relationship is modeled now so it is not a later migration on the central tables.

## Consequences

Easier: approving a company signal produces a durable record; the company-to-people link has a home from day one. Harder/accepted: a new entity and its read paths; the expansion logic (firmographic pre-check, title-filtered role expansion) remains deferred, so `Person.company_id` is mostly null until that job lands. A company-signal approval creates exactly one `Company` (1:1, recorded by `SignalDecision.created_entity_id`). This ADR also introduces a routing change: the signal-to-many-people fan-out that a company used to trigger is re-homed onto the deferred `Company -> Person` expansion path - building on ADR-0013's move of fan-out to approval time, but the `Company` intermediary is this ADR's own decision. ADR-0005's one-to-many cardinality is preserved - it still describes the eventual signal-to-many-people outcome, now reached for companies via the `Company -> Person` step decided above rather than directly. Cross-source/cross-origin company dedup is out of scope (a scoping choice), consistent with the existing per-source dedup stance. This is additive in entity shape, with the single cross-ADR effect being the fan-out re-homing just noted.
