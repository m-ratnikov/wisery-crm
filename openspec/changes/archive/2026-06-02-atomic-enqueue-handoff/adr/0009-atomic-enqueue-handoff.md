# ADR-0009: Atomic enqueue-in-transaction for pipeline handoffs

- Status: proposed
- Date: 2026-06-02
- Supersedes: none
- Source: [system-design.md](../system-design.md) (Decisions and trade-offs); refines [ADR-0001](../../../../docs/adr/0001-background-job-runtime.md) (in-process pg-boss durability), relates to [ADR-0004](../../../../docs/adr/0004-pg-boss-facade.md) (pg-boss facade)

## Context

The background pipeline advances a prospect by enqueueing the next stage's job. Stages are decoupled: each commits its state write, then a hook at the composition root fires the next job, so no stage imports a sibling. <!-- v:fact src/lib/runtime/bootstrap.ts wires onSignalsPersisted/onProspectsQualified/onEnriched hooks -->

Because the enqueue runs AFTER the state transaction commits, there is a strand window: if the process dies or the enqueue fails transiently between the commit and the send, the prospect is left in a recoverable-but-stuck disposition (e.g. `qualified` with no draft). <!-- v:derives system-design.md Key runtime flows --> The upstream stage's idempotency skip then prevents a retry from re-emitting the handoff, so the prospect never advances without manual intervention. <!-- v:fact src/lib/qualify/pipeline.ts skips a signal that already produced a prospect --> The domain model already names this an accepted gap and defers its resolution to a reliability decision. <!-- v:fact docs/architecture/domain-model.md events-table "Current implementation note" -->

Two forces shape the resolution. First, the decoupled-seam property (a stage imports no sibling stage; wiring lives in one place) is an existing architectural value worth preserving. <!-- v:derives ADR-0004 jobs facade as a single localized seam --> Second, pg-boss 12 can enqueue a job using a caller-supplied Drizzle transaction (`boss.send(queue, data, { db: fromDrizzle(tx, sql) })`), so the job INSERT can ride the same transaction and connection as the state write. <!-- v:fact pg-boss 12.18.2 exports fromDrizzle in dist/adapters/drizzle.d.ts --> This is only atomic when the `pgboss` schema and the app tables share one Postgres database, which is the default (`PGBOSS_DATABASE_URL` falls back to `APP_DATABASE_URL`). <!-- v:fact src/lib/config/env.ts line 41 -->

## Decision

We will enqueue each pipeline stage's follow-on job inside the same Drizzle transaction as that stage's state write, using pg-boss's `fromDrizzle` adapter, so the state transition and its handoff job commit atomically or not at all. <!-- v:decision --> The composition root injects a transaction-aware `enqueueNext(tx, ids)` callback into each stage's pipeline; the stage calls it within its transaction and imports no sibling stage, preserving the decoupled seam. <!-- v:decision --> The network/LLM call that a stage may need stays OUTSIDE the transaction (computed before the writes begin); only database writes are inside it. <!-- v:decision --> The atomic guarantee is contingent on pg-boss sharing the app's Postgres database; a split `PGBOSS_DATABASE_URL` pointing at a separate database is not supported for atomic handoff. <!-- v:assumption a cross-database transaction cannot commit atomically without two-phase commit, which we do not adopt -->

## Consequences

Easier: a committed transition can no longer strand a prospect with a missing follow-on job; the at-least-once-with-strand posture becomes exactly-once-handoff for the in-database path, with no new background machinery (no reconciliation sweep, no outbox relay) and no extra round-trip or second transaction per handoff. <!-- v:derives system-design.md Decisions and trade-offs -->

Harder / accepted: the jobs facade gains a transactional-enqueue entry point and the stage pipelines gain an `enqueueNext` parameter, a slightly larger surface than fire-and-forget hooks. <!-- v:decision --> Deployments are now constrained to co-locate pg-boss in the app database to keep the guarantee; this is documented in cross-cutting canon and is the default, but it removes the option of an isolated pg-boss database without re-opening this decision. <!-- v:assumption --> A reconciliation sweep is explicitly NOT built; if a future non-transactional handoff is introduced (e.g. an external trigger that cannot share the transaction), that gap would need its own decision, and a sweep remains the clean defense-in-depth option then. <!-- v:decision --> This refines but does not supersede ADR-0001: handler errors still propagate for pg-boss retry and dead-letter; the change is only that the handoff enqueue now shares the state transaction. <!-- v:derives ADR-0001 -->
