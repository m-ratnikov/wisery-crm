# review-queue Specification

## Purpose

Anchor view #2 and the highest-judgment surface: the human reviews each open prospect's dossier, draft, and score, acts manually through the chosen channel (the system never sends, D2), and logs the outcome against the exact score it was acted on - closing the M1 walking product end to end and capturing the learning signal (D7). The queue is the prospects with open work (`queued` awaiting action, `acted` awaiting an outcome log); act and log-outcome are two steps, so an acted prospect stays on the surface until its outcome is recorded.

## Architecture

- Decisions: [ADR-0008](../../../docs/adr/0008-prospect-status-is-disposition.md) (the `queued -> acted -> closed` / `queued -> dismissed` disposition transitions; "enriched"/"drafted" are derived from relations, not statuses), D2 (the system never sends - acting records a human action), D7 (the outcome binds to `score_at_time` so the precision bar is tunable later without a migration), D1 (auth deferred, noted at the route/actions seam). Pipeline: [product-overview.md](../../../docs/product-overview.md) section 4.
- Data model: `OUTCOME` (nullable `draft_id`, `score_at_time` snapshot, `result` enum) and the `Prospect` lifecycle in [domain-model.md](../../../docs/architecture/domain-model.md).
- `listQueue()` (`src/lib/queue/read.ts`) is a read-model composed from small queries (no join multiplicity), reusing `prospectsWithSignal()` from the prospect read-model. The transitions (`src/lib/queue/transitions.ts`) are tolerant: act/dismiss are conditional updates from `queued`; `logOutcome` makes the `acted -> closed` conditional UPDATE the atomic single-winner claim, so a double-submit inserts exactly one `Outcome`. Wired as a Server Component + `'use server'` actions under `src/app/review-queue/`, graduating the prototype `review-queue` screen; see the [prototype registry](../../../src/app/prototype/README.md).

## Requirements
### Requirement: The queue presents open prospects for review

The system SHALL present the prospects with open work for human review - those in the `queued` disposition (awaiting action) and those in the `acted` disposition (awaiting an outcome log) - each with its selected draft, its latest score, and its dossier when one exists, so the human can judge, act, and log the result. A prospect in a terminal or pre-queue disposition (`new`, `below_bar`, `qualified`, `dismissed`, `closed`) SHALL NOT appear in the queue.

#### Scenario: A queued prospect appears with its draft and score

- **WHEN** a prospect has been drafted and is queued
- **THEN** it appears in the review queue with its selected draft and its latest score

#### Scenario: An acted prospect remains visible until its outcome is logged

- **WHEN** a prospect has been acted on but its outcome is not yet logged
- **THEN** it remains in the queue so the human can log the outcome
- **AND** once the outcome is logged and it moves to `closed`, it leaves the queue

### Requirement: The human acts manually; the system never sends

The system SHALL let the human mark a queued prospect as acted - recording that they performed the outreach themselves through the chosen channel - and SHALL NOT send any message automatically. Acting moves the prospect to the acted disposition.

#### Scenario: Marking a prospect acted

- **WHEN** the human acts on a queued prospect via the channel and marks it acted
- **THEN** the prospect moves to the acted disposition, with no message sent by the system

### Requirement: The human can dismiss a queued prospect

The system SHALL let the human dismiss a queued prospect without acting; a dismissed prospect leaves the queue and is retained.

#### Scenario: Dismissing a prospect

- **WHEN** the human dismisses a queued prospect
- **THEN** it moves to the dismissed disposition and no longer appears in the queue

### Requirement: Outcomes are logged against the score for the learning loop

The system SHALL let the human log the outcome of an acted prospect (connected, replied, booked, or no response), recording it against the score the prospect was acted on and the draft that was sent, and moving the prospect to closed. The recorded outcome SHALL be retained so the precision bar can be tuned from real results later (D7).

#### Scenario: Logging an outcome closes the loop

- **WHEN** the human logs an outcome for an acted prospect
- **THEN** an outcome is recorded against that prospect's score (and its selected draft)
- **AND** the prospect moves to the closed disposition

