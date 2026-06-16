## Context

ADR-0019 left person scoring with two triggers: approval promotes the signal's advisory hint into an `advisory`-provenance `scorings` row, and a re-score button runs the LLM scorer on demand. Qualification (qualified / below_bar / unassessed) is a derived read over the latest icp-rubric Scoring (ADR-0020), surfaced on the prospect list and detail. The owner's call: the score's whole job is done at triage, on the signal - after approval, a person is managed by pipeline status, and the second scoring system is dead weight. The `outcomes.score_at_time` column exists only in the schema today (the old review-queue route that wrote it was deleted in the engagement rework), and the D7 learning loop is planned, not built.

This is a deletion change: no new capability, no new mechanism, one new migration.

## Goals / Non-Goals

**Goals:**

- `signal_advisory` is the only score in the system; the `scorings` table and everything that reads or writes it are gone.
- Approval creates the entity only (entity routing, decision row, pipeline entry status) - no advisory promotion.
- People surfaces (prospect list, detail, prototype people screens) show identity, pipeline status, source, and facets - no score, no qualification.
- `outcomes.score_at_time` is dropped in the same migration.

**Non-Goals:**

- Redesigning the D7 learning loop around signal advisory scores (future change; the superseding ADR records the intent).
- Truing up the review-queue / drafting canon staleness left by the engagement rework beyond what scoring touches.
- Touching the advisory filter, rubric versioning/seeding, or the icp-config screen behavior (rubrics keep all three kinds; the advisory filter stays their consumer).
- Any data preservation for `scorings` (pre-launch dev data).

## Decisions

1. **Diverge from ADR-0019 and ADR-0020, superseded via a parallel architecture change.** This design knowingly retires ADR-0019's scoring model (promotion + on-demand re-score + provenance column) and narrows ADR-0020 (qualification-as-derived-read disappears; the pipeline-status half stands). Per `openspec/config.yaml`, the superseding ADR is recorded via a separate `spec-driven-architecture` change (`adr-signal-only-scoring`), drafted in parallel with this one. Gate: that ADR must be accepted (human sign-off, verify-gate) before this change archives; the ADR also carries the `docs/architecture/domain-model.md` (SCORING entity, ProspectScored/ProspectQualified events) and cross-cutting D7 edits, so canon docs are not edited from this code change.
2. **Drop `scorings`, do not freeze it.** Alternative considered: keep the table read-only for provenance. Rejected - it is dev-stage data, no learning loop consumes it, and a dead table invites accidental coupling. One new immutable Drizzle migration drops the table (its FKs to `person`/`rubric` go with it) and drops `outcomes.score_at_time`. Generated with `drizzle-kit generate` by the implementer (never by a review agent).
3. **Qualification disappears rather than re-deriving from the advisory score.** Alternative considered: keep the badge, computed via `person.signal_id -> signal_advisory`. Rejected by the owner - manual-origin people have no signal and would sit "unassessed" forever with no re-score path, and the human's approve/dismiss verdict already is the gate. The `Qualification` type, `gateStatus`, and `latestIcpScorings` reads are deleted, not relocated.
4. **Drop `outcomes.score_at_time` now, redesign D7 later.** Alternative considered: repoint it at the advisory score at touch time. Rejected - nothing writes outcomes today, so we would be designing a learning-loop binding speculatively. The column goes; the future loop binds outcomes to signal advisory data when it is actually designed.
5. **Approval simplification stays inside `approveSignal`.** The pre-transaction advisory/rubric resolution and the in-transaction Scoring insert (`src/lib/triage/decide.ts`) are deleted; the routing-by-kind transaction, `signal_decisions` idempotency, and pipeline entry-status resolution are untouched. The triage read (advisory hint on the lane) is untouched.
6. **Bootstrap orphan-queue cleanup stays.** `deleteQueue("qualify-prospect")` / `deleteQueue("draft")` in `src/lib/runtime/bootstrap.ts` exist to clean queues lingering in existing databases; removing person scoring does not change that need. Leave them.
7. **The scorer core relocates, it does not die (implementation finding).** The advisory filter (`src/lib/triage/advisory.ts`) was reusing `scoreProspect` from the qualify slice, and through it the `icp_score_v1` prompt. Since the advisory filter is now the scorer's only consumer, the LLM-call core moves into the triage slice as `src/lib/triage/scorer.ts` (`scoreSubject`, taking the already-resolved rubric - which also removes a double rubric fetch); the prompt file stays unchanged for prompt-version traceability.
8. **The enrichment qualification gate goes (implementation finding).** `loadActionableProspect` returned null for a non-qualified person, making enrich a silent skip. With qualification deleted, the human's triage approval is the gate: the loader becomes `loadProspectSubject` (always resolves, throws on missing), and `enrichProspect` loses its `skipped` outcome. Enrich is user-triggered (ADR-0007), so enriching any admitted person on an explicit click is the intended cost model.
9. **Prototype follows in the same change.** People list/detail drop the Scoring state, re-score gesture, ScoreBadge/QualificationBadge usage, and `scoreAtTime` on outcome rows; `_data/types.ts` drops `Qualification`, `Provenance`, and narrows score types to the advisory usage; the README registry rows for people screens are updated (CLAUDE.md prototype rule). `ScoreBadge` itself survives only if still used by signal/queue screens (it is - the advisory hint); `QualificationBadge` is deleted.

**Reuse:** pure deletion against existing seams - data via `src/lib/db` (Drizzle schema + migration), reads via the existing `src/lib/prospect` read-model, triage via `src/lib/triage`. No new config, jobs, or LLM usage; net LLM surface shrinks by one prompt (`icp_score_v1`).

## Risks / Trade-offs

- [Accepted-but-stale canon: ADR-0019 text contradicts the code between this change landing and the ADR's acceptance] → sequence both to land together; this change does not archive until `adr-signal-only-scoring` is accepted and signed off.
- [D7 promise dangles: product-overview and cross-cutting docs reference outcome-to-score binding] → the superseding ADR rewrites the D7 note to "learning loop redesign over signal advisory, deferred"; until then the dangling references live in docs the ADR change owns.
- [Deleting `src/lib/qualify` breaks hidden importers] → dependency-cruiser + typecheck in `npm run verify` catch any residual import; tests that exercised qualification are deleted or rewritten in the same change, and per-file coverage keeps the surviving read-model honest.
- [Losing the cheap "is this person worth my time" cue on the People list] → the advisory score remains one click away on the originating signal; if practice shows the cue is missed on the list, surfacing the signal's advisory score via join is a small additive follow-up that needs no schema change (origin-signal join already exists for source chips).
- [review-queue delta modifies requirements whose surrounding capability is already stale] → the delta is scoped strictly to score mentions; the broader true-up is flagged as a known gap, not silently absorbed here.

## Migration Plan

1. Land code + the new migration in one slice (deletion-first is safe: nothing writes `scorings` after `decide.ts` and the qualify slice are gone).
2. Migration is forward-only and destructive by intent (DROP TABLE `scorings`; ALTER TABLE `outcomes` DROP COLUMN `score_at_time`). Rollback = restore from a dev snapshot; acceptable pre-launch.
3. Archive only after the parallel ADR change is accepted (human sign-off).

## Open Questions

- None blocking. The exact shape of the future advisory-based learning loop is explicitly deferred to its own explore + ADR.
