## Context

The foundation and posts slices have landed. Today the pipeline auto-fans-out at `SignalPersisted` (a person signal enqueues qualify, which creates+scores the prospect) and auto-gates at score >= 3. This slice replaces that with a human triage gate and demotes the score to advisory. The shipped seams it touches: `signal-ingestion`'s persisted-signal kind routing, the signal-keyed `qualifySignal`, and the review-queue surface.

## Goals / Non-Goals

**Goals:** universal triage (advisory filter, triage Queue lane, approve/dismiss); approval routing by kind in one atomic transaction; demote scoring to advisory; peer scoring.

**Non-Goals:** company-to-people expansion (deferred); comment generation (next slice); changing the post-approval `type = prospect` pipeline beyond removing the auto-create-at-persist entry; the chat-configured scanner / bridge-finding graph.

## Decisions

### D1. Advisory filter: its own bounded queue, enqueued-in-tx, run-outside-tx

Universal triage scores **every** signal (not just person-kind) and widens intake to noisy sources, so an inline or uncapped advisory call is an unbounded LLM cost/rate-limit path. The advisory-filter is a dedicated pg-boss queue with capped concurrency (`teamConcurrency`/`batchSize`) and retry-backoff; the job is enqueued inside the signal's persist transaction (the existing `enqueueNext` seam, ADR-0009) but the LLM call runs later, on the worker, outside any transaction. A per-tick ceiling (and, optionally, a cheap non-LLM pre-filter on broad sources) bounds the spend. It writes an advisory result to the triage read-model, never a `Scoring` row (ADR-0013, ADR-0017).

### D2. Approval is one Drizzle transaction that extends the atomic-enqueue handoff

The triage approve action writes `SignalDecision(approved)` + the routed entity + (for `type = prospect`) enqueues qualify, all in one Drizzle transaction (ADR-0009), so a committed approval is never stranded without its next job and the worker still owns the downstream pipeline. The LLM advisory pass already ran pre-approval, so no I/O sits inside the transaction. `created_entity_id` records the single primary entity (the Person for a content approval; the Post is reached via `Post.person_id`), written once, never updated.

### D3. Stop the auto-fan-out at `SignalPersisted`

`SignalPersisted` stops routing by kind to a downstream handoff (person->qualify, non-person->await normalize-expand). It now persists the immutable signal and enqueues only the advisory-filter job. The signal-keyed `qualifySignal` (which created and scored the prospect) is removed in favor of the prospect-keyed qualify enqueued at approval (the prospect-keyed entry already exists from `manual-lead-entry`). This is the load-bearing behavior change; `npm run verify` + targeted tests guard the new path.

### D4. Content approval reuses the posts core; peers are scored on the peer rubric

A content-signal approval creates the author `Person(type = peer)` and a `Post` for the signal's content by calling the posts core from the engagement-posts slice (no second posts path). A `type = peer` person is scored against the rubric WHERE `kind = 'peer'` (a durable peer `Scoring`), which drives engagement filtering; it never enters the draft/send funnel (ADR-0015, ADR-0017).

### D5. Queue is two independent lanes under one nav

`kind = triage | send` is presentation grouping: the triage lane reads `signals LEFT JOIN signal_decisions WHERE disposition IS NULL`; the send lane reads `person WHERE status = queued`. They share a nav surface, not a query, component state, or action handler.
