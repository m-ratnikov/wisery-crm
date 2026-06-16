## 1. Delete the write and read paths (code first, so nothing touches scorings before the drop)

- [x] 1.1 Simplify `src/lib/triage/decide.ts`: remove the pre-transaction advisory/rubric resolution and the in-transaction advisory-promotion Scoring insert from `approveSignal`; keep routing-by-kind, `signal_decisions` idempotency, and pipeline entry-status resolution intact. Verify: triage tests still pass; approving a person signal creates the Person and nothing else.
- [x] 1.2 Delete `reScoreAction` from `src/app/(app)/prospect-list/actions.ts` and its `src/lib/qualify` import. Verify: typecheck green for the actions module.
- [x] 1.3 Simplify `src/lib/prospect/read.ts`: remove the `latestIcpScorings` join and the `score` / `summary` / `qualification` fields from `listProspects` and `getProspectDetail`. Verify: prospect-list read-model tests updated and green.
- [x] 1.4 Update prospect-list UI (`src/app/(app)/prospect-list/_components/ProspectGrid.tsx`, `[id]/page.tsx`): drop the min-score filter state, score column, summary subtext, qualification badge, score reasoning section, and the re-score button. Verify: build green; the grid renders identity, pipeline status, source, facets only.
- [x] 1.5 Delete `src/lib/qualify/` (pipeline, read, status). Implementation finding: the advisory filter reuses the scorer core + `icp_score_v1` prompt, so the scorer RELOCATED to `src/lib/triage/scorer.ts` (`scoreSubject`, takes the resolved rubric) and the prompt stays; `src/prompts/README.md` updated accordingly. The enrichment qualification gate went with qualification: `loadActionableProspect` -> `loadProspectSubject` (no gate), `enrichProspect` loses `skipped`. The `triage-bypass-guard` test (guarding the now-deleted `qualifySignal`) was deleted. Verify: typecheck + dependency-cruiser find no dangling importers.
- [x] 1.6 Fix the stale comment in `src/lib/prospect/manual.ts` ("unassessed until the user re-scores" - no qualification concept exists anymore); the code itself already conforms (no enqueue, entry status).

## 2. Schema and migration

- [x] 2.1 Remove the `scorings` table and `outcomes.score_at_time` from `src/lib/db/schema.ts` (update the outcomes comment to drop the score-binding claim; leave `signal_advisory`, `rubric`, the rest of `outcomes` untouched).
- [x] 2.2 Generate one new migration with `drizzle-kit generate` (immutable once applied; never edit an applied migration) and confirm it contains exactly DROP TABLE `scorings` and ALTER TABLE `outcomes` DROP COLUMN `score_at_time`. Apply to the dev database. Verify: app boots, triage approval works against the migrated schema.

## 3. Tests

- [x] 3.1 Delete `tests/qualification.test.ts` and any qualify-status/gate test files; strip score and qualification assertions from `tests/prospect-list.test.ts`, `tests/pipeline.test.ts`, and triage tests (replace the "approval promotes advisory" cases with "approval writes no score" assertions per the universal-triage delta). Verify: full suite green, per-file coverage floor holds for the surviving modules.

## 4. Prototype wireframes

- [x] 4.1 Update `src/app/prototype/(app)/_data/types.ts` (drop `Qualification`, `Provenance`; keep `Score` / `ScoreOrInsufficient` / `AdvisoryScore` for the signal advisory usage) and `_data/people.ts` (drop `scorings` arrays, `latestIcpScoring` / `qualificationOf` helpers, score/summary projections, `scoreAtTime` on outcome fixtures).
- [x] 4.2 Update people screens (`people/page.tsx`, `people/[id]/page.tsx`): remove score sorting, qualification filter, Scoring state, the re-score gesture, and `scoreAtTime` display on outcome rows; delete `_components/QualificationBadge.tsx`; keep `ScoreBadge` only for signal advisory surfaces (queue/feed). Verify: prototype routes render; no imports of the deleted component remain.
- [x] 4.3 Update the prototype `README.md` registry rows for the people screens (capability join: prospect-list, person-model; no qualification). Verify: registry reflects the screens as shipped.

## 5. Canon gate and verification

- [x] 5.1 Confirm the parallel `adr-signal-only-scoring` architecture change is accepted and human-signed (it supersedes ADR-0019, narrows ADR-0020, and carries the domain-model.md / D7 doc edits). DONE: ADR-0022 accepted (owner sign-off 2026-06-13), verify-gate passed, promoted to docs/adr/0022 and re-sliced into canon (product-overview, glossary, domain-model, system-context, system-design, cross-cutting).
- [x] 5.2 Run `npm run verify` (typecheck, lint, format, dependency-cruiser, jscpd, per-file coverage, build) and a `code-review` pass on the diff; loop fixes through re-verify + re-review until a pass finds nothing material.
