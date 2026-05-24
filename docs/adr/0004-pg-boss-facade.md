# ADR-0004: Background jobs use a thin pg-boss facade (testability, not portability); Postgres stays the queue substrate

- Status: accepted
- Date: 2026-05-23 (accepted + promoted 2026-05-24)
- Supersedes: none. Does **not** amend ADR-0001 - the no-rewrite-peel property and transactional-enqueue use are unchanged (see Consequences).
- Source: openspec/changes/c4-level2-architecture/system-design.md (Decisions - "Thin pg-boss facade, not a portability seam") and the C4 L2 review of database lock-in, including the gate's Greybeard finding (Graphile Worker omission) and Atlas finding (a `JobQueue` swap port was premature).

## Context

ADR-0001 chose pg-boss in-process on managed Postgres, no Redis, using `SKIP LOCKED` claiming and transactional enqueue.

A lock-in concern was raised - a preference, on principle, not to be coupled to Postgres - with no concrete requirement to run on another database, partly motivated by a desire for a CQRS / MediatR-style architecture. Two findings reframed it:

- **CQRS needs no Redis.** CQRS is a code pattern and MediatR is an in-process mediator (no broker, even in .NET); its Node.js equivalent is an in-process command/query/event mediator. So the CQRS goal drives no queue or infrastructure change and is decided separately.
- **There is no battle-tested storage-agnostic Node.js job queue.** Agenda v6 is genuinely pluggable, but its Postgres backend is a recent, unproven separate package; `@platformatic/job-queue` is pre-1.0 with no Postgres backend (Redis for distributed use); BullMQ is mature but Redis-only - a *different* lock-in - and cannot do transactional enqueue.

A first pass proposed a `JobQueue` **port** as a swap seam. The design panel pushed back, correctly: (Atlas) it was premature - one adapter, no requirement, and the recommended command-handler path (transactional enqueue) is non-portable, so the dominant usage pattern punches straight through the seam; (Greybeard) the survey omitted **Graphile Worker**, and transactional enqueue is not pg-boss's distinguishing property but a property of any Postgres-backed queue.

## Decision

Keep pg-boss in-process on Postgres (**ADR-0001 unchanged**). Wrap pg-boss behind a **thin facade** whose purpose is **testability/mocking and one localized call site** for the pg-boss API - explicitly **not a portability or swap seam**.

The queue stays **intentionally Postgres-coupled**. Command handlers use transactional enqueue freely (a job created atomically with its originating data write); jobs are **not** constrained to stay backend-portable, because no requirement asks for it.

Survey of the real alternatives, recorded so the choice is honest: the mature Postgres-native peers are **pg-boss and Graphile Worker** (both support transactional enqueue and cron). pg-boss is chosen for its singleton/debounce, dead-letter ergonomics, and larger install base - **not** because it is the only mature option. Redis/BullMQ is rejected (a different lock-in; no transactional enqueue); storage-agnostic libraries are rejected as immature.

## Consequences

- **No amendment to ADR-0001.** Because no portability claim is made, there is no new per-job obligation, and ADR-0001's no-rewrite-peel property (in-process -> standalone `worker.ts`, same code) is untouched - the peel is about process topology, not the queue backend. Transactional enqueue remains a feature we use, exactly as ADR-0001 framed it.
- The facade buys testability and a single place the pg-boss API is touched; it does **not** buy database portability. A real backend change (e.g. Redis arriving for its own reason - real-time pub/sub - or a scale pg-boss cannot meet) would be a **future superseding ADR** and, for transactional-enqueue jobs, a rewrite (an outbox), not a free adapter swap. Stated so no one mistakes the facade for a swap seam.
- Transactional enqueue is a Postgres-backed-queue property, not a pg-boss differentiator; if pg-boss itself ever needs replacing **on Postgres**, Graphile Worker is the like-for-like candidate (it keeps transactional enqueue), and the facade makes that call-site change small.
- Adds a thin indirection for testability - accepted as cheap. The lock-in concern is acknowledged and consciously **not** solved by speculative abstraction: the honest finding is that an in-database queue's best property (transactional enqueue) is exactly what couples it to Postgres, and that coupling is wanted.
- CQRS is implemented as an in-process mediator (its own decision, no infra) and composes with this: a command handler does its transactional Postgres write and enqueues the follow-up job in the same transaction.
