## Why

The pipeline drafts prospects into the `queued` disposition, but there is no surface for the human to act and no way to record what happened - so the loop never closes and the learning signal (D7) is never captured. The review/approve queue is anchor view #2 and the highest-judgment surface (A1+A3, D2): review the dossier and draft, act manually through the channel, and log the outcome against the score the prospect was acted on. This closes the M1 walking product end to end.

## What Changes

- **One data table** (next migration): `outcomes` (`prospect_id` FK, nullable `draft_id` FK, `score_at_time` smallint, a `result` enum `connected | replied | booked | no_response`, `channel`, nullable `notes`, `occurred_at`, `created_at`). Models the domain-model `OUTCOME`; `score_at_time` is what binds the outcome to the exact score for the learning loop (D7).
- **The queue read-model** (`src/lib/queue`): `listQueue()` - the prospects with open work (`queued` awaiting action, `acted` awaiting an outcome log) with their selected draft, latest score, name, and whether a dossier exists, ready for review.
- **The human-action transitions** (`src/lib/queue`): `actProspect` (`queued -> acted`, the human sent the touch manually - D2, never automated), `logOutcome` (`acted -> closed`, writes an `Outcome` against the latest score + the selected draft), and `dismissProspect` (`queued -> dismissed`).
- **Anchor view #2, wired**: a Server Component queue at a real route - each card shows the dossier, the selected draft, an assisted-action deep link to the channel, and act / dismiss / log-outcome controls - graduating the prototype `review-queue` screen. Server Actions wrap the transitions.

Not in scope: outcome-driven tuning of the score bar (deferred per D7 - data accrues now); the email channel (LinkedIn-first); autonomous sending (never, D2); multi-touch sequences.

## Capabilities

### New Capabilities
- `review-queue`: the human reviews each queued prospect's dossier and draft, acts manually through the chosen channel (the system never sends), and logs the outcome (connected / replied / booked / no_response) against the score the prospect was acted on; a prospect can also be dismissed. Acting and the logged outcome move the prospect through `acted` to `closed`, and the outcome is retained against its score for the learning loop (D7).

### Modified Capabilities
<!-- None. A new table + read-model + status transitions + UI over existing prospects/drafts/dossiers/scorings; no other capability's requirements change. -->

## Impact

- **Schema / migrations**: `src/lib/db/schema.ts` gains `outcomes` + the `outcome_result` pg enum; next migration (immutable, after 0006).
- **New code**: `src/lib/queue/` - `listQueue`, `actProspect`, `logOutcome`, `dismissProspect`; a non-prototype app route (`src/app/review-queue/`) - Server Component + `'use server'` actions + queue-card components adapted from the prototype.
- **Reused seams**: `src/lib/db`; the prospect/scoring/draft/dossier rows produced upstream; the disposition vocabulary in `src/lib/qualify/status.ts` (`queued`/`acted`/`dismissed`/`closed`). No new env var.
- **Tests**: integration (gated) - `listQueue` returns queued prospects with their draft + score; `actProspect` moves queued->acted; `logOutcome` writes an `Outcome` with the correct `score_at_time` + `draft_id` and moves acted->closed; `dismissProspect` moves queued->dismissed; below-flow guards. The app route/actions are coverage-excluded.
- **D1 note**: the Server Actions are unauthenticated by design (single-user MVP), documented at the route.
- **Governed by**: A1+A3/D2 (assisted action, human-only sending), D7 (outcome against the score), ADR-0008 (the disposition transitions; `acted`/`closed`/`dismissed`), ADR-0005 (`score_at_time` binds to the per-prospect score). Architecture: `docs/product-overview.md` (journey steps 7-8); the prototype screen is the design reference.
