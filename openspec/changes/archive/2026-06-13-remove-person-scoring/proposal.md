# Remove person scoring - the score lives on the signal only

## Why

The advisory score on signals already carries the only scoring decision that matters: it informs the human triage verdict, and approval IS the qualification. Carrying a second, person-keyed scoring system after that point (the advisory-promotion write at approval, the on-demand re-score pipeline, the derived qualified/below_bar/unassessed read) re-asserts a judgment the human already made, and costs a table, an LLM pipeline, a prompt, a Server Action, and UI surface. A person, once approved into the pipeline, is managed by pipeline status - not by a score.

## What Changes

- **BREAKING**: the `scorings` table is dropped (new migration; pre-launch dev data, no preservation). The signal-keyed `signal_advisory` becomes the only score in the system.
- The qualify slice is deleted: `src/lib/qualify/` (pipeline, qualification read, gate/status) and the on-demand re-score Server Action. The scorer core and the `icp_score_v1` prompt survive - the advisory filter is their only remaining consumer, so they relocate into the triage slice (`src/lib/triage/scorer.ts`).
- The enrichment gate goes with qualification: `loadActionableProspect`'s "only a qualified prospect is enriched" check is removed (the human's approval is the gate); any person is enrichable on demand.
- Signal approval no longer promotes the advisory score into a person Scoring - it creates the entity only. The advisory hint stays visible on the signal where the judgment happened.
- The Qualification concept (qualified / below_bar / unassessed, derived from the latest icp Scoring) is removed from reads and UI. People carry pipeline status and type only.
- **BREAKING**: `outcomes.score_at_time` is dropped in the same migration. The D7 learning loop, when it is built, gets redesigned around signal advisory scores - that redesign is explicitly out of scope here.
- Prospect list and person detail lose the score / summary / qualification columns, the min-score filter, and the re-score affordance.
- Prototype wireframes follow: people list/detail drop Scoring state, ScoreBadge and QualificationBadge on people, the re-score gesture, and `scoreAtTime` on outcome rows; the prototype README registry is updated.
- Unchanged: rubrics and the icp-config screen (the advisory filter still scores signals against the active rubric of each kind), the advisory filter itself, pipelines, messages, enrichment.
- A parallel `spec-driven-architecture` change records the superseding ADR (ADR-0019's scoring model is retired; ADR-0020's qualification-as-derived-read claim is narrowed). Both changes land together.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `qualification`: capability retired - every requirement is removed. Signal-to-prospect fan-out is owned by `universal-triage` approval routing; no person-level scoring, gating, or auto-enqueue remains.
- `universal-triage`: approval creates the entity only - no qualification enqueue, no promotion of the advisory hint into a durable per-person score. The advisory hint stays signal-only.
- `prospect-list`: the list and detail show identity, pipeline state, source, and facets - no score, no qualification badge, no score filter, no re-qualify affordance.
- `manual-lead-entry`: adding a lead creates the person; nothing is enqueued for qualification, and the re-qualify-after-failed-enqueue requirement disappears with it.
- `review-queue`: an outcome is logged against the person (and the message acted on), no longer against a score-at-time snapshot.

## Impact

- **Schema/migration**: drop `scorings`, drop `outcomes.score_at_time` (one new immutable migration). `signal_advisory`, `rubric`, `outcomes` (rest) untouched.
- **Deleted code**: `src/lib/qualify/*` (the scorer core relocates to `src/lib/triage/scorer.ts`; `src/prompts/icp_score_v1.ts` stays as the advisory filter's prompt), `reScoreAction` in `src/app/(app)/prospect-list/actions.ts`, qualification tests, the `triage-bypass-guard` fitness test (its guarded symbol no longer exists).
- **Simplified code**: `src/lib/triage/decide.ts` (no advisory resolution + promotion), `src/lib/prospect/read.ts` (no scoring joins), `src/app/(app)/prospect-list/` grid + detail, `src/lib/runtime/bootstrap.ts` (orphaned-queue cleanup for `qualify-prospect` can go once nothing references it).
- **Prototype**: `src/app/prototype/(app)/people/*`, `_data/people.ts`, `_data/types.ts` (Scoring/Qualification/Provenance types), `_components/ScoreBadge.tsx` + `QualificationBadge.tsx`, README registry.
- **Docs/canon**: superseding ADR via the parallel architecture change; `docs/architecture/domain-model.md` SCORING entity and cross-cutting D7 notes follow that change.
- **Not affected**: signal advisory scoring end to end, rubric versioning and seeding, configurable pipelines, LinkedIn messages, enrichment/dossiers, posts/comments.
