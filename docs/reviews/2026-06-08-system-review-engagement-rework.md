# System review - engagement-rework convergence

- Mode: convergence
- Scope: the engagement-rework code delta across slices 1-3 (the unified Queue + advisory-score promotion; configurable pipelines + qualification-as-a-read; the LinkedIn Message entity + Person workspace).
- Range reviewed: `bfc12ec..f78cb3b` (`git diff bfc12ec..f78cb3b -- src/ drizzle/`).
- Reviewed commit: f78cb3b (fixes applied on top; see disposition).
- Lenses: static-composition (A), lifecycle-reachability (B), invariant-canon (C), chair synthesis.

## Verdict

**ship-with-fixes** -> fixes applied -> **ship**. The converged tree is structurally sound (composition root wired correctly, ports honored, server-only intact, migrations consistent). The lenses surfaced four material findings (one strand-bug, one read contradiction, one operational-surface drift, one canon drift) plus structural/DRY gaps; the material ones and the cheap structural wins are fixed, `npm run verify` green (216 tests, 0 clones, coverage 97.5%).

## Punch list

| # | Sev | Location | Claim | Lenses | Disposition |
|---|-----|----------|-------|--------|-------------|
| 1 | major | qualify/pipeline.ts `qualifyProspect` <- scorer.ts:45 | A prospect created before any ICP rubric exists strands at `unassessed`: its only outbound edge (re-score) threw a 500 instead of skipping. | B | **fixed** - `qualifyProspect` resolves `getActiveRubric(BUYER_RUBRIC_KIND)` first and returns `skipped` when absent (mirrors the peer skip); the person stays `unassessed` and recovers once a rubric exists. |
| 2 | major | prospect/read.ts `listProspects` / `getProspectDetail` | The displayed `score` took the globally-latest Scoring (any rubric kind / provenance), so a peer could show `score 4` next to `qualification unassessed` - violating ADR-0019 "every read filters by provenance + rubric kind". | C (also A) | **fixed** - both score reads now go through the shared `latestIcpScorings` (buyer-rubric-filtered), so the displayed score matches the qualification; a peer/advisory non-icp row shows no buyer score. |
| 3 | major | app/(app)/jobs/_components/JobsMonitor.tsx | The monitor still labelled the retired `draft` and `qualify-prospect` queues as active workers and omitted the live `advisory-filter` / `fetch-posts` / `activity-scan`. | A, C | **fixed** - `QUEUE_LABELS` / `QUEUE_DESCRIPTIONS` updated to the current registered worker set. |
| 4 | major | docs/architecture/domain-model.md:129 | Canon declared `PIPELINE_STATUS.is_entry boolean`, but the schema/code use position-0 as the entry status (no such column). | C | **fixed** - removed `is_entry` from the ERD; the `position` note states "position 0 is the entry status". |
| 5 | major | qualify/pipeline.ts `qualifySignal` | `qualifySignal` creates a Person directly from a Signal, bypassing universal triage (ADR-0013); it is test-only but nothing prevented a future `src/` consumer from re-arming the bypass. | A | **promoted-to-fitness-function** - `tests/triage-bypass-guard.test.ts` fails if any non-test module under `src/` references `qualifySignal`. |
| 6 | nit | qualify/read.ts, qualify/pipeline.ts | The load-bearing `"icp"` qualification filter literal was copy-pasted across the qualify reads (4 sites). | A, C | **fixed** - single-sourced as `BUYER_RUBRIC_KIND` (icp/schema.ts) + the shared `latestIcpScorings` query builder. |
| 7 | minor | ProspectGrid.tsx / [id]/page.tsx (peer rows) | Peers appear in the person list with a Re-score button that is a silent no-op (re-score is prospect-only). | B | **accepted-with-reason** - not a strand or crash; the action safely skips (finding 1's guard) and a peer is intentionally `n/a` for buyer qualification (ADR-0019). The clean fix (hide the button for peers, render an "n/a (peer)" badge) belongs with the Person-workspace UI follow-up that also handles peers-in-the-list. Recorded as a known UX gap. |
| 8 | minor | icp/config.ts `saveRubric` | `saveRubric` hardcodes `kind = "icp"`, so it cannot save a peer/company rubric; the name does not express the restriction. | C | **accepted-with-reason** - the icp-config UI is buyer-only today; when ADR-0017's peer/company config surfaces, parameterize `saveRubric(kind)` or rename to `saveIcpRubric`. No current incorrect path. |
| 9 | minor | enrich-queue.ts `enqueueEnrichInTx`; jobs label set | Queue-wrapper enqueue fns and the monitor label map have no build-enforced contract (a future direct importer / a label/queue mismatch goes uncaught). | A | **accepted-with-reason** - candidate fitness functions (a depcruiser rule restricting `*-queue.ts` wrapper imports to the composition root; a test tying `QUEUE_LABELS` keys to the registered queue set). Recorded as the next mechanization; not blocking. |

## Lens cross-check (no contradictions)

The lenses agreed; no contradiction to surface. Finding 7 (peer re-score) was raised by lens B as a UX dead-action and is consistent with lens C's score/qualification separation - both point at "peers are n/a for buyer qualification", resolved at the read level (finding 2) with the UI gating deferred. All confirmed findings carried an exhibited path; none was a single-diff issue the per-slice `code-review` should have caught (each spans the converged slices).

## Fitness functions written / proposed

- Written: `tests/triage-bypass-guard.test.ts` (retires the "test-only path re-armed from src/" class for `qualifySignal`).
- Proposed (finding 9): a `*-queue.ts`-wrapper import-direction depcruiser rule; a registered-queues vs `QUEUE_LABELS` consistency test. These would retire the operational-surface-drift class that produced finding 3.
