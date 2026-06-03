## Actors

Out of scope for this change. This is a pure internal-mechanics change to the durability of background-pipeline handoffs; no actor crosses the system boundary differently and no user-facing goal changes.

## Use cases

Skipped per the proposal (use-cases marked Skip). The relevant "actor" is the pipeline itself; its behavior is specified in system-design and the ADR. The user-visible invariant this protects - a qualified prospect always reaches the review queue rather than silently stalling - is already covered by the existing capability use-cases (qualification, drafting, review-queue).

## Primary journey

Unchanged. See the existing primary journey in docs/product-overview.md. This change only makes the existing scan -> qualify -> draft / enrich handoffs durable; it does not add or reorder steps.

## Acceptance signals

- Durability (from the proposal): if a worker process is killed at any point during a stage's commit, no prospect is left in a non-terminal disposition with its follow-on job missing. Verified in system-design and the ADR, not here.
