# review-queue Specification

## Purpose

Anchor view #2 and the highest-judgment surface: the human reviews each open prospect's dossier, draft, and score, acts manually through the chosen channel (the system never sends, D2), and logs the outcome against the exact score it was acted on - closing the M1 walking product end to end and capturing the learning signal (D7). The queue is the prospects with open work (`queued` awaiting action, `acted` awaiting an outcome log); act and log-outcome are two steps, so an acted prospect stays on the surface until its outcome is recorded.

## Architecture

- Decisions: [ADR-0008](../../../docs/adr/0008-prospect-status-is-disposition.md) (the `queued -> acted -> closed` / `queued -> dismissed` disposition transitions; "enriched"/"drafted" are derived from relations, not statuses), D2 (the system never sends - acting records a human action), D7 (the outcome binds to `score_at_time` so the precision bar is tunable later without a migration), D1 (auth deferred, noted at the route/actions seam). Pipeline: [product-overview.md](../../../docs/product-overview.md) section 4.
- Data model: `OUTCOME` (nullable `draft_id`, `score_at_time` snapshot, `result` enum) and the `Prospect` lifecycle in [domain-model.md](../../../docs/architecture/domain-model.md).
- `listQueue()` (`src/lib/queue/read.ts`) is a read-model composed from small queries (no join multiplicity), reusing `prospectsWithSignal()` from the prospect read-model. The transitions (`src/lib/queue/transitions.ts`) are tolerant: act/dismiss are conditional updates from `queued`; `logOutcome` makes the `acted -> closed` conditional UPDATE the atomic single-winner claim, so a double-submit inserts exactly one `Outcome`. Wired as a Server Component + `'use server'` actions under `src/app/review-queue/`, graduating the prototype `review-queue` screen; see the [prototype registry](../../../src/app/prototype/README.md).
## Requirements
### Requirement: The queue presents open prospects for review

The system SHALL present the people with open work for human review, each with its working materials (its dossier when one exists, and its engagement artifacts), so the human can judge, act, and log the result. The queue SHALL NOT present a per-person score; the advisory score belongs to the signal in the triage lane.

#### Scenario: A queued person appears with its working materials

- **WHEN** a person has open work
- **THEN** it appears for review with its working materials
- **AND** no per-person score is shown

#### Scenario: An acted person remains visible until its outcome is logged

- **WHEN** a person has been acted on but its outcome is not yet logged
- **THEN** it remains visible so the human can log the outcome

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

### Requirement: Outcomes are logged for the learning loop

The system SHALL let the human log the outcome of an acted-on person (connected, replied, booked, or no response), recording it against the person and the engagement artifact acted on. The recorded outcome SHALL be retained so the learning loop can be built from real results later (D7, redesigned around signal advisory scores).

#### Scenario: Logging an outcome

- **WHEN** the human logs an outcome for a person they acted on
- **THEN** an outcome is recorded against that person (and the artifact acted on)
- **AND** it is retained for later analysis

