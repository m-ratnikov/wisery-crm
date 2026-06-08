## 1. Stop auto-fan-out at persist

- [x] 1.1 In `src/lib/signals` change the persisted-signal handoff: `SignalPersisted` persists the immutable signal and enqueues the advisory-filter job only - no person creation, no kind-routed qualify enqueue.
- [x] 1.2 Remove the signal-keyed auto-create-and-score entry (`qualifySignal`) from the live path; the prospect-keyed qualify entry (from `manual-lead-entry`) becomes the only qualify entry, enqueued at approval.

## 2. Advisory filter (own bounded queue)

- [x] 2.1 Add the advisory-filter core: select the rubric WHERE `kind` matches the signal's intent (person->icp, content/peer->peer, company->company), run it via `LLMProvider`, write an advisory result to the triage read-model; write NO `Scoring`.
- [x] 2.2 Register a dedicated pg-boss queue for it with capped concurrency + retry-backoff and a per-tick ceiling; enqueue one job per new signal inside the persist tx (ADR-0009), executed outside it.

## 3. Triage read-model + Queue triage lane

- [x] 3.1 Add the triage read-model: `signals LEFT JOIN signal_decisions WHERE disposition IS NULL`, enriched with the advisory result.
- [x] 3.2 Add the Queue `kind = triage` lane (Server Component) listing pending signals + the advisory hint; keep the existing review/approve queue as the `send` lane (presentation grouping, no shared query/handler).

## 4. Approval / dismissal routing

- [x] 4.1 Approve server action: in one Drizzle transaction write `SignalDecision(approved)`, create the routed entity by kind (person->`Person(type=prospect)`; company->`Company`; content->author `Person(type=peer)` + `Post` via the posts core), set `created_entity_id` to the primary entity, and for `type = prospect` enqueue qualify (ADR-0009). 
- [x] 4.2 Dismiss server action: write `SignalDecision(dismissed)`; verify a later re-scan with the same dedup key is a no-op on the signal and does not resurface it.

## 5. Scoring demoted to advisory + peer scoring

- [x] 5.1 Qualify (post-approval, `type = prospect`) creates the durable `Scoring` against the active `icp` rubric, as before but triggered at approval.
- [x] 5.2 Peer scoring: a `type = peer` person is scored against the active `peer` rubric (durable `Scoring`), driving engagement filtering; it does not enter draft/send.

## 6. Verification

- [x] 6.1 Unit/integration: a persisted signal creates no entity until approved; approve routes by kind to exactly the right primary entity (+ Post for content) in one tx and enqueues qualify for prospects; dismiss survives a re-scan; the advisory pass writes no `Scoring`.
- [x] 6.2 Update the prototype registry (`src/app/prototype/README.md`) for the Queue triage lane.
- [x] 6.3 `npm run verify` green; `code-review` pass on the diff (the intake behavior change), then re-run `verify` on the fix delta before archive.
