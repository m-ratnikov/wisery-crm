# ADR-0009: Atomic enqueue-in-transaction for pipeline handoffs

- Status: accepted
- Date: 2026-06-02
- Refines: ADR-0001 (background job runtime), ADR-0004 (pg-boss facade)
- Supersedes: none
- Source: openspec/changes/archive/2026-06-02-atomic-enqueue-handoff

## Context

The background pipeline advances a prospect by enqueueing the next stage's job. Stages are decoupled: each commits its state write, then a hook at the composition root fires the next job, so no stage imports a sibling. Because the enqueue ran AFTER the state transaction committed, there was a strand window: if the process died or the enqueue failed transiently between the commit and the send, the prospect was left in a recoverable-but-stuck disposition (e.g. `qualified` with no draft), and the upstream stage's idempotency skip then prevented a retry from re-emitting the handoff, so the prospect never advanced without manual intervention. The domain model already named this an accepted gap and deferred its resolution to a reliability decision.

Two forces shaped the resolution. First, the decoupled-seam property (a stage imports no sibling stage; wiring lives in one place) is an existing architectural value worth preserving. Second, pg-boss 12 can enqueue a job using a caller-supplied Drizzle transaction (`boss.send(queue, data, { db: fromDrizzle(tx, sql) })`), so the job INSERT can ride the same transaction and connection as the state write. This is only atomic when the `pgboss` schema and the app tables share one Postgres database, which is the default (`PGBOSS_DATABASE_URL` falls back to `APP_DATABASE_URL`).

## Decision

We will enqueue each pipeline stage's follow-on job inside the same Drizzle transaction as that stage's state write, using pg-boss's `fromDrizzle` adapter, so the state transition and its handoff job commit atomically or not at all. The composition root injects a transaction-aware `enqueueNext(tx, ids)` callback into each stage's pipeline; the stage calls it within its transaction and imports no sibling stage, preserving the decoupled seam. The network/LLM call that a stage may need stays OUTSIDE the transaction (computed before the writes begin); only database writes are inside it. The atomic guarantee is contingent on pg-boss sharing the app's Postgres database; a split `PGBOSS_DATABASE_URL` pointing at a separate database is not supported for atomic handoff, because a cross-database transaction cannot commit atomically without two-phase commit, which we do not adopt.

## Consequences

Easier: a committed transition can no longer strand a prospect with a missing follow-on job; the at-least-once-with-strand posture becomes exactly-once-handoff for the in-database path, with no new background machinery (no reconciliation sweep, no outbox relay) and no extra round-trip or second transaction per handoff.

Harder / accepted: the jobs facade gains a transactional-enqueue entry point (`enqueueInTx`) and the stage pipelines gain an `enqueueNext` parameter, a slightly larger surface than fire-and-forget hooks. Deployments are now constrained to co-locate pg-boss in the app database to keep the guarantee; this is the default, but it removes the option of an isolated pg-boss database without re-opening this decision. A reconciliation sweep is explicitly NOT built; if a future non-transactional handoff is introduced (e.g. an external trigger that cannot share the transaction), that gap would need its own decision, and a sweep remains the clean defense-in-depth option then. This refines but does not supersede ADR-0001: handler errors still propagate for pg-boss retry and dead-letter; the change is only that the handoff enqueue now shares the state transaction. User-triggered enqueues (manual/batch enrich, regenerate-draft) remain fire-and-forget via the facade's `enqueue`, since they are not pipeline handoffs and surface their failure to the user directly.
