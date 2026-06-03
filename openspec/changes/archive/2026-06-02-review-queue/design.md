## Context

Drafting leaves prospects `queued` with a selected draft (ADR-0008). Anchor view #2 is the human-action surface (A1+A3, D2): review the dossier + draft, act manually, log the outcome against the score (D7). This is the last spine of the M1 walking product. It adds the `outcomes` table, a queue read-model, the disposition transitions, and the wired surface - the same shape as the other anchor views (read-model + Server Component + Server Actions).

## Goals / Non-Goals

**Goals:** the `outcomes` table; `listQueue()`; the `actProspect` / `logOutcome` / `dismissProspect` transitions with `score_at_time` binding (D7); the wired queue surface with an assisted-action affordance. **Non-Goals:** sending (never, D2); outcome-driven bar tuning (deferred, D7); the email channel; multi-touch sequences.

## Decisions

### D-A: `outcomes` table + a closed `outcome_result` enum
`outcomes`: `id`, `prospect_id` FK -> prospects RESTRICT, `draft_id` FK -> drafts RESTRICT **nullable** (an outcome can be logged for a touch that used no generated draft), `score_at_time` smallint (the score the prospect was acted on - the D7 binding), `result` `outcome_result` pg enum (`connected | replied | booked | no_response` - closed, low-churn), `channel` text, `notes` text nullable, `occurred_at` timestamptz default now, `created_at`. Index on `prospect_id`.

### D-B: `listQueue()` - the review read-model
Returns the prospects with open work - `queued` (awaiting action) and `acted` (awaiting an outcome log) - with their name, latest score + reason, the selected draft body, and whether a dossier exists - everything a card needs to judge. `acted` is included because act and log-outcome are two steps (see D-C / the deferred open question): the prospect must stay on the surface between them. Composed from small queries like `listProspects` (no join multiplicity), reusing `prospectsWithSignal()`. Lives in `src/lib/queue/read.ts`.

### D-C: The disposition transitions are tolerant and bind the outcome to the score
In `src/lib/queue/transitions.ts`:
- `actProspect(id)`: `queued -> acted` (the human sent the touch; the system sends nothing, D2). No-op if not `queued` (idempotent under double-submit).
- `dismissProspect(id)`: `queued -> dismissed`. No-op if not `queued`.
- `logOutcome(id, { result, notes? })`: in one transaction the conditional UPDATE `acted -> closed` (`WHERE status = 'acted'`) is the atomic claim - only one caller wins, so a double-submit inserts exactly one `Outcome`; the winner then records `score_at_time` = the prospect's latest score, `draft_id` = its selected draft (or null), and the `result`/`channel`/`notes`. No-op if not `acted`. A missing scoring on an acted prospect is a broken invariant and throws (never a fabricated score). The `score_at_time` snapshot is what lets the precision bar be tuned later without a migration (D7).

### D-D: Anchor view #2 is a Server Component + Server Actions (coverage-excluded UI)
A route under `src/app/review-queue/` renders cards from `listQueue()`: each shows the score, the dossier (if any), the selected draft, an assisted-action deep link to the channel, and act / dismiss / log-outcome controls. Server Actions (`'use server'`) wrap the transitions and `revalidatePath`. The two-step flow (mark acted, then log outcome) follows the lifecycle; the card shows the controls valid for the prospect's current disposition. Auth deferred (D1), documented.

## Risks / Trade-offs

- **Two-step act-then-outcome** -> matches reality (you send now, learn the result later); the card adapts to the disposition. A combined "acted + result" is an additive convenience later.
- **`score_at_time` is a snapshot, not a live join** -> intentional (D7): the bar can change without rewriting what a past outcome was judged against.
- **Tolerant no-op transitions** -> a double-submit or stale card cannot corrupt the disposition; the action simply does nothing if the prospect already moved.
- **`draft_id` nullable** -> an outcome can be logged even if the touch used no generated draft (a manual message); the selected draft is captured when present.

## Migration Plan

1. Add `outcomes` + `outcome_result` to `schema.ts`; `db:generate` -> review (table, enum, nullable draft FK, index); `db:migrate`.
2. Build `src/lib/queue/` (`read.ts`, `transitions.ts`) with integration tests.
3. Build the route (Server Component + actions + cards) adapted from the prototype.
4. Update the prototype registry note (graduated). 
5. **Rollback:** drop `outcomes` + the enum (nothing references them); migrations immutable.

## Open Questions

- The assisted-action deep-link target per source (a profile URL from the signal payload vs a generic channel link) - best-effort from the payload now, refined when real adapters land.
- Whether `logOutcome` should also be reachable directly from `queued` (act+log in one) - deferred; two steps now.
