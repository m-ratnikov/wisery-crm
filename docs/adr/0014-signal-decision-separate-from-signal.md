# ADR-0014: The triage decision is a separate entity; signals stay immutable

- Status: accepted
- Date: 2026-06-06
- Supersedes: none
- Source: docs/explore/2026-06-06-content-marketing-engagement.md; system-design.md (Decisions and trade-offs)

## Context

Universal triage (ADR-0013) introduces a human verdict on each signal - `pending`, `approved`, or `dismissed` - that is mutable over time. Signals are an append-only, immutable fact with no status column by deliberate decision (D-C), and they dedup on `(source_id, dedup_key)`, so a scheduled scan re-encounters the same signal on every run. A mutable status on the signal row would put two writers on one hot table - the insert-only scanner and the decision writer - and a re-scan upsert could reset a human dismissal back to pending; it would also supersede the accepted D-C invariant. Under universal triage each signal resolves to exactly one approve decision at triage time (company-to-people expansion is a later step), so the fan-out is no longer a reason the decision cannot live in one place - the re-scan-clobber risk and the immutability invariant are.

## Decision

We will record the triage verdict in a separate `signal_decisions` table keyed `unique` on `signal_id`, holding the disposition (`approved` | `dismissed`), the decision time, and a nullable reference to the entity an approval produced; `pending` is the absence of a row. `signals` stays immutable (D-C preserved); the scan writer only ever inserts signals and never touches `signal_decisions`, so a re-scan is a no-op on the signal and cannot reset a decision. The triage inbox is the read `signals LEFT JOIN signal_decisions WHERE disposition IS NULL`, enriched with the advisory filter result.

## Consequences

Easier: the immutable-fact invariant and the dedup/idempotency story are preserved, and the two writers never contend. Decision history (re-open a dismissal, audit who/when) has a natural home if added later. Harder/accepted: the inbox read is a LEFT JOIN rather than a single-column filter, and there is one more table. The authoritative link from a decision to what it created is the reverse FK (`Person.signal_id` / `Company.signal_id` - the renamed-Person and Company entities introduced by ADR-0015 and ADR-0016); `created_entity_id` on the decision is a convenience denormalization, not the source of truth. When an approval produces more than one row (a content signal creates the author `Person(type = peer)` *and* a `Post`), `created_entity_id` records only the single primary entity - the `Person` - and the `Post` is reached via `Post.person_id`; the broader signal-to-many-people fan-out (ADR-0005) is carried by those reverse FKs, never by this single column. `created_entity_id` is written once, inside the same transaction that creates the entity, and is never updated after (it is null only for a `dismissed` decision). This is an additive decision next to D-C, not a supersession - D-C stays in force.
