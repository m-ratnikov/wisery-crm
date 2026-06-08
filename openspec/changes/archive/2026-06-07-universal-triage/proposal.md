## Why

ADR-0013 (universal triage), ADR-0014 (SignalDecision), and ADR-0017 (advisory rubrics) are accepted. With the model foundation (`signal_decisions`, `rubric.kind`, `Person.type`, `Company`) and the posts substrate in place, this slice **reworks intake**: every persisted signal now waits in a human triage inbox; the ICP score is demoted from an auto-gate to an advisory hint; approval routes by kind to a Person, a Company, or a peer-author + Post. This removes the shipped auto-fan-out-then-auto-gate behavior - the invasive reframe the architecture exists to enable, and the reason it is sequenced after the additive slices.

## What Changes

- **Stop auto-fan-out at persist**: `SignalPersisted` no longer creates a Person or enqueues qualify. Persisted signals await triage. (Modifies `signal-ingestion`'s kind-routed handoff.)
- **Advisory filter**: a per-signal job in its **own capped-concurrency pg-boss queue**, enqueued inside the signal's persist transaction (ADR-0009) but executed outside it; it runs the rubric WHERE `kind` matches the signal's intent (person->icp, peer/content->peer, company->company) and writes an advisory result to a triage read-model. It writes **no Scoring** row (the learning loop is never polluted by a pre-approval hint).
- **Triage Queue lane**: the Queue gains a `kind` discriminator. The **triage lane** reads `signals LEFT JOIN signal_decisions WHERE disposition IS NULL` plus the advisory result, with approve/dismiss actions. The existing review/approve queue becomes the **send lane** (presentation grouping; the lanes share no query or handler).
- **Approval routing (one tx, ADR-0009)**: approve writes `SignalDecision(approved)` + the routed entity in one Drizzle transaction and, for `type = prospect`, enqueues qualify - person signal -> `Person(type = prospect)`; company signal -> `Company`; content signal -> author `Person(type = peer)` + a `Post` (reusing the posts core). `created_entity_id` records the single primary entity, written once. Dismiss writes `SignalDecision(dismissed)`; a re-scan cannot resurface it.
- **Peer scoring**: a `type = peer` person is scored against the peer rubric (a durable peer `Scoring`), driving engagement filtering/ranking; it does not enter the draft/send funnel.

## Capabilities

### New Capabilities

- `universal-triage`: every persisted signal awaits a human approve/dismiss in the Queue's triage lane, annotated with an advisory hint; approval routes by kind to the right entity; a dismissed signal cannot resurface after a re-scan.

### Modified Capabilities

- `qualification`: the ICP score is advisory at triage and writes no Scoring; the durable per-person Scoring is created after approval, by the qualify job, for `type = prospect`; the rubric is selected by kind. The signal-keyed auto-create-and-score-at-persist entry is removed.
- `signal-ingestion`: `SignalPersisted` no longer routes by kind to a downstream handoff; it persists the immutable signal and enqueues the advisory-filter job only.
- `review-queue`: becomes the Queue's send lane; behavior unchanged otherwise.

## Impact

- **Migration**: none new (the foundation already added `signal_decisions`, `rubric.kind`, `Person.type`, `Company`).
- **New code**: the advisory-filter handler + its dedicated queue; the triage read-model + Queue triage lane + approve/dismiss server actions; the approval routing core (one tx: SignalDecision + entity + enqueue) reusing the posts core for content approvals; the peer-scoring path.
- **Modified code**: `src/lib/signals` (drop the auto-handoff at persist, enqueue advisory-filter); `src/lib/qualify` (advisory pre-read writes no Scoring; durable Scoring after approval; kind-aware rubric); the Queue surface (two lanes).
- **Governed by**: ADR-0013 (universal triage, refines ADR-0005 trigger), ADR-0014 (signal_decisions), ADR-0017 (advisory rubrics, refines ADR-0005), ADR-0009 (atomic approval handoff), ADR-0016 (Company), ADR-0018 (content->Post). D11 in product-overview.
- **Risk**: this changes the shipped intake path; the advisory filter's own bounded queue + per-tick ceiling are the cost guard for scoring every signal across noisy sources.
