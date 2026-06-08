# ADR-0013: Universal triage gate at intake

- Status: accepted
- Date: 2026-06-06
- Refines: ADR-0005 (fan-out trigger/timing only; the one-to-many cardinality and the per-person Scoring are preserved)
- Source: docs/explore/2026-06-06-content-marketing-engagement.md; system-design.md (Decisions and trade-offs)

## Context

Today a persisted `Signal` auto-fans-out into a `Prospect` and the qualifier auto-gates it to `qualified`/`below_bar`; the only human gate is later, at send. The content-marketing motion widens the signal stream to broad, noisy sources (Google-web search, standalone content) and to peers who must not be scored on the buyer rubric. Auto-filling the prospect list from those sources contradicts the product thesis of keeping the human in control of what enters the CRM, and force-scoring peers on the ICP rubric would mislabel them below-bar and hide them. The fan-out cardinality (one signal to many people) and the per-person Scoring remain correct and are not in tension - only the timing of fan-out and the auto-gate are.

## Decision

We will gate intake with a universal triage step: every persisted `Signal` awaits a human approve/dismiss decision before any entity is created - with no per-source bypass. The ICP score is demoted from an auto-gate to an advisory hint shown at triage; the durable per-person `Scoring` (ADR-0005) is still created after approval, by the `qualify` job, for `type = prospect` people, so the learning loop is unchanged. Fan-out cardinality and `Prospect.origin` (ADR-0010) are unchanged; what moves is the trigger - fan-out now fires on triage approval, not unconditionally at persist. Approval is a web server action that, in one Drizzle transaction, writes the `SignalDecision`, creates the routed entity, and - for `type = prospect` - enqueues `qualify` through the ADR-0009 atomic-enqueue handoff, so a committed approval is never stranded without its next job and the worker owns the downstream pipeline as before.

## Consequences

Easier: the CRM user controls what enters the CRM; broad and content sources become usable without flooding the prospect list; peers enter without being force-scored. Harder/accepted: intake now needs human attention on every signal (mitigated by the advisory filter, which pre-reads and ranks each item so the approve/dismiss decision is fast); the shipped auto-fan-out-then-auto-gate behavior is removed, not merely extended. This refines ADR-0005's fan-out *trigger* (its cardinality and the per-person Scoring are untouched), so the canonical `SignalPersisted` domain event and the prospect Lifecycle entry transition (`[*] --> New`) must move from persist-time to approval-time at promotion. This decision is the home of the demotion of scoring to advisory; the SignalDecision storage that records the verdict is ADR-0013's companion shape but is detailed where it is modeled (domain-model). ADR-0008 (status is disposition-only) and ADR-0010 (origin) stay in force unchanged; this ADR does not touch the post-approval prospect lifecycle. The advisory filter mechanism (which rubric runs for which intent) is recorded separately in the type-keyed-rubric ADR.
