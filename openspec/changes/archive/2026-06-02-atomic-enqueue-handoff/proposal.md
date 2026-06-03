## Why

The pipeline stages hand off to the next stage via fire-and-forget hooks at the composition root: a stage commits its state write, then a separate enqueue fires the next job. If the process dies or the enqueue fails transiently after the commit, the prospect is stranded in a recoverable-but-stuck disposition (e.g. `qualified` with no draft), and the upstream idempotency skip means a retry never re-emits the handoff. The domain model already names the atomic ideal - enqueue the next job in the same transaction as the state write - as a tracked reliability decision deferred to M1. pg-boss 12 makes this cleanly feasible (`send` accepts a Drizzle transaction via `fromDrizzle`), so this change resolves the deferred decision.

## Scope

**In:**
- The durability contract for stage-to-stage handoffs in the background pipeline (scan -> qualify -> draft / enrich -> re-draft).
- The jobs facade seam that enqueues a job inside an existing Drizzle transaction.
- How the composition root wires the handoff so a stage still imports no sibling stage (an injected transaction-aware enqueue callback, not a direct import).

**Out:**
- The job retry / dead-letter posture itself (ADR-0001, unchanged - handlers still propagate errors).
- The prospect lifecycle states and the disposition vocabulary (ADR-0008, unchanged).
- Any new pipeline stage or any change to what each stage computes.
- A transactional-outbox relay or a reconciliation sweep (considered and rejected in the ADR; not built).
- Multi-database / split-pg-boss-database topologies (the atomic path requires pg-boss to share the app database; documented as a constraint, not supported-and-handled).

## Views

- `use-cases`: Skip - pure internal mechanics; no actor crosses the system boundary differently and no user-facing goal changes.
- `domain-model`: Skip - no entity shape, relationship, or lifecycle state changes. The only canon touch is revising the existing "Current implementation note" on the events table (the strand) to record the atomic handoff.
- `system-design`: Required - the change alters the runtime handoff mechanism between pipeline containers (the enqueue-in-transaction flow), which is system-design content.
- `deployment`: Skip - where things run does not change; pg-boss is already co-located in the app database by default. The "must stay co-located for atomicity" constraint is recorded in the ADR and cross-cutting, not as a topology change.

## Quality attributes

- **Durability**: a committed state transition and its follow-on job MUST be atomic - either both durable or neither. No prospect is left in a non-terminal disposition because an enqueue failed after the state commit.
- **Availability**: the handoff MUST NOT couple stages such that one stage imports another; the decoupled-seam property (a stage hands off via an injected callback) is preserved.
- **Cost/latency**: no extra network round-trip and no second transaction per handoff (the enqueue rides the state-write transaction on the same connection).

## Impact on canon

- Overview sections (docs/product-overview.md): the section 4 pipeline note (handoffs are atomic, not fire-and-forget); resolve the related reliability open question if present.
- System-wide views: docs/architecture/cross-cutting.md - the background-jobs reliability/durability concern (at-least-once-with-strand -> atomic enqueue-in-transaction; the same-database co-location constraint).
- Area views (docs/architecture/): domain-model.md - replace the events-table "Current implementation note" (the strand caveat) with the atomic-handoff resolution; system-design.md - the runtime handoff flow between the pipeline workers.
- ADRs: docs/adr/0009-atomic-enqueue-handoff.md (the decision; refines ADR-0001 job durability, relates to ADR-0004 jobs facade).
