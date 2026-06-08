# Tasks

## 1. Schema + migration
- [x] 1.1 Add `scorings.provenance` (`llm | advisory`, NOT NULL default `llm`); generate additive migration 0015.

## 2. Approval promotes the advisory score
- [x] 2.1 `approveSignal`: drop `enqueueQualify`; resolve the advisory + active rubric before the tx (safeParse the kind); promote an `advisory`-provenance Scoring when promotable; derive disposition via `gateStatus`; company / unknown-kind / no-rubric write no Scoring and still succeed.

## 3. Retire the drafting stage + review queue
- [x] 3.1 Delete `src/lib/draft/*`, the draft prompt, `src/app/(app)/review-queue/*`, `src/lib/queue/*`.
- [x] 3.2 `bootstrap.ts`: remove draft + qualify-prospect workers and the post-qualify handoff; enrichment no longer re-drafts; add guarded `deleteQueue("draft")` / `deleteQueue("qualify-prospect")`.

## 4. Retire the qualify-prospect worker; synchronous re-score
- [x] 4.1 Delete `src/lib/qualify/qualify-queue.ts`; `qualifyProspect` is the prospect-only synchronous re-score (no scored-already guard, `llm` provenance).
- [x] 4.2 `reScoreAction` calls `qualifyProspect` synchronously; `addLeadAction` no longer auto-scores.

## 5. Unify the Queue surface
- [x] 5.1 Rename `/triage` -> `/queue` (sole intake, Create Person/Company, advisory-score filter); `listTriage` `minScore` filter keeps the LEFT JOIN; remove the `/review-queue` nav item.
- [x] 5.2 Trim `prospectStatusSchema` to `new | below_bar | qualified`.

## 6. Tests + gate
- [x] 6.1 Update/delete tests (drafting + review-queue removed; advisory-promotion, no-auto-score, provenance covered).
- [x] 6.2 `npm run verify` green (typecheck, lint, format, dependency-cruiser, jscpd 0%, per-file 75% coverage, build) + code-review pass applied.
