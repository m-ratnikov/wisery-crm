# Why

Implements Slice 1 of the engagement-rework (ADR-0019, now canon): the drafting stage is removed, intake is unified into one Queue, approval promotes the advisory score into the person's initial Scoring, and the durable `qualify-prospect` worker is retired. Code realization of the architecture ratified in `openspec/changes/archive/2026-06-08-engagement-rework`.

# What Changes

- Add `scorings.provenance` (`llm | advisory`, NOT NULL default `llm`); migration `drizzle/0015_orange_tony_stark.sql` (additive).
- `approveSignal` (src/lib/triage/decide.ts): no longer enqueues qualify. For a person/peer approval it promotes the signal's advisory score into one initial `Scoring` (provenance `advisory`, the `advisory` sentinel in provider/prompt/model, no LLM) when an active rubric of the advisory's kind exists; the disposition derives from that score (`gateStatus`). A company approval, an unknown advisory kind (safeParse degrade), or a missing rubric writes no Scoring (the person stays `new`/unassessed) and approval still succeeds.
- Retire the drafting stage: delete `src/lib/draft/*`, the draft prompt, the `review-queue` route, and `src/lib/queue/*` (the review-queue read-model + transitions); remove the draft + qualify-prospect worker registration and the post-qualify handoff from `bootstrap.ts`; enrichment no longer re-drafts. Add a one-time guarded `deleteQueue("draft")` / `deleteQueue("qualify-prospect")` cleanup.
- Retire the `qualify-prospect` worker (src/lib/qualify/qualify-queue.ts deleted). Re-score becomes a synchronous, prospect-only on-demand server action (`reScoreAction` -> `qualifyProspect`, additive, no scored-already guard, `llm` provenance); manual entry no longer auto-scores.
- Unify the Queue: rename `/triage` -> `/queue` (the sole intake, "Create Person/Company", an advisory-score filter); remove the `/review-queue` nav item; `listTriage` gains an optional `minScore` filter keeping the LEFT JOIN anti-strand.
- Trim `prospectStatusSchema` to `new | below_bar | qualified` (the drafting/review statuses are gone). Keep the `drafts`/`outcomes` tables frozen.

The `drafts` table is kept (frozen) because `outcomes.draft_id` still references it (ADR-0019). The qualification read and the `Person.status` -> pipeline FK are Slice 2; `Person.status` stays text here.
