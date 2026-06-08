# Verification record - content-marketing-engagement

Gate: `docs/verification-gate.md` (groundedness -> design challenge -> synthesis). Run 2026-06-07, reworked and re-run 2026-06-07.

## Result: PASS (pending human sign-off)

Stage 1 (groundedness) CLEAN for all 9 artifacts; Stage 2/3 (design panel + chair) verdict **ship-with-fixes** (not rework); mechanical checks green. The change went one full rework cycle: the first run returned **rework** on 2 blockers + 9 majors + a self-contradiction; all were addressed and the re-run confirms each RESOLVED across all four lenses, with the residual three nits also applied. The only thing outstanding is the mandatory human sign-off for the six ADRs (the agent must not self-sign).

## Artifacts covered (git hash-object at verification time, post-rework)

| Artifact | Stage 1 | hash-object |
|---|---|---|
| use-cases.md | CLEAN | 4fa37108b9fe3f778f40bdbc4a73e28d9d925199 |
| domain-model.md | CLEAN | 64018176c13a4c98af8eb8cd4829510b873fc638 |
| system-design.md | CLEAN | 3c5cc91ee76ff8bfacf4b6ed7df948820b882250 |
| adr/0013-universal-triage-intake.md | CLEAN | 8ef5d9847421cebc5e1b02187f89e69ac61134fa |
| adr/0014-signal-decision-separate-from-signal.md | CLEAN | 74f5eed602f35b2209cb266e0f6da4b695653883 |
| adr/0015-prospect-to-person-with-type.md | CLEAN | c7dc2c61759c402984ee928643f8ee0b64037648 |
| adr/0016-company-first-class-entity.md | CLEAN | bdf39723d509850e69bc7180fbd5a300277d95c9 |
| adr/0017-type-keyed-advisory-rubrics.md | CLEAN | 14b7baf753e2bd7081231b5d86145bc8bcf40cec |
| adr/0018-engagement-artifacts-post-comment.md | CLEAN | 2704a4bf7319b3af18fef6d87c12340f685385f6 |

Any edit to an artifact above makes this record stale for that artifact - re-run the gate.

## Mechanical checks (task 0.6)

`npx vitest run tests/mermaid.test.ts tests/arch-links.test.ts` - 40/40 passing.

## Stage 1 - groundedness

`ledger` agent over each artifact, re-run on the reworked content. No unsupported facts, no underivable claims. ADR-0014/0015 needed an anchor-hygiene pass in the first cycle; ADR-0016 needed three tag-precision passes in the rework (its `Company -> Person` re-homing is the ADR's own `v:decision`, not a derivation from ADR-0013; trailing config/scoping clauses anchored). All 9 CLEAN.

## Stage 2/3 - design panel + chair (post-rework)

Panel: atlas (boundaries), greybeard (technology), pedant (C4 notation), canon (ADR fidelity). Chair verdict: **ship-with-fixes**.

Headline: all prior blockers/majors and the supersession contradiction are RESOLVED; the four lenses converge with no live disagreement; the only remaining "fix" is the human promotion sign-off, not code.

### How the first-run findings were resolved (rework summary)
- B1 (buried ADR-0005 supersession + dead canonical event path): ADR-0013 header now `Refines: ADR-0005 (fan-out trigger/timing only; cardinality + per-person Scoring preserved)`; ADR-0017 `Refines: ADR-0005` (rubric scope); the canonical `SignalPersisted` event + prospect Lifecycle `[*] --> New` move to approval-time named in proposal Impact-on-canon and tasks 1.1/2.2; task 0.5 rewritten so it no longer contradicts the headers.
- B2 (unbounded advisory LLM filter): advisory-filter is its own capped-concurrency pg-boss queue, enqueued in each signal's own persist tx via the existing `enqueueNext` seam (ADR-0009) but never executed in it, with a per-tick ceiling and an optional cheap pre-filter; added to the Scaling/capacity narrative.
- M1 (approval->enqueue seam): approval is one Drizzle tx writing SignalDecision + routed entity + qualify-enqueue (ADR-0009), no in-tx I/O - strand window closed.
- M2 (created_entity_id cardinality): holds the single primary entity (Person for content approval; Post via Post.person_id), fan-out rides reverse FKs, write-once; company approval is 1:1; use-cases reworded.
- M3 (rubric constraint): `rubric_one_active_uq` -> one-active-per-kind named; qualifier kind-aware.
- M4 (D-decision / D5 refined): new D-entry + D5-refined recorded in proposal + tasks 1.1 (product-overview edit task-gated to promotion).
- M5 (activity-scan): fan-out dispatcher, one fetch-posts job per monitored person (D-K).
- M6 (comment guidance schema): `comment_guidance` singleton + COMMENT_GUIDANCE ERD entity (single active row, partial unique index WHERE active).
- M7 (post dedup_key): provider stable id else canonicalized permalink else drop.
- M8 (stale ADR-0008/0010 after rename): ADR-0015 read-through + task 4.5 forward notes (incl. ADR-0010 scoped-supersession clarification).
- M9 (L1 legend): added.
- minors (comment-gen synchronous everywhere incl. tasks/use-cases; Queue two-lane; fetchPosts port method; comment lifecycle no self-loop; Engagement-target sequence participant; advisory writes no Scoring; HTTPS / RSC): all applied.

### Residual (all nits, all applied)
- ADR-0010 header scoped-supersession clarification - task-gated to promotion (task 4.5).
- COMMENT_GUIDANCE single-active enforcement specified (partial unique index WHERE active).
- Queue anchor-view merger recorded in proposal Impact-on-canon (anchor-view roster).

## Human sign-off

High-stakes (six ADRs promoting to immutable canon). The agent must not self-sign. The sign-off should confirm the `Refines: ADR-0005` scoping on ADR-0013/0017 and the scoped reading of ADR-0010's existing `Supersedes: ADR-0005` header are the intended standing decisions (once accepted, ADRs are immutable and only superseded, not edited).

- [x] sign-off: Michael Ratnikov (msratnikov@gmail.com), 2026-06-07 - approved ADRs 0013-0018 as standing decisions (incl. the Refines: ADR-0005 scoping on 0013/0017 and the scoped reading of ADR-0010's Supersedes: ADR-0005). Promotion authorized.

## Promotion note (2026-06-07)

One mechanics correction was made during promotion, after sign-off: the planned forward notes on the
immutable docs/adr/0005, 0008, 0010 were dropped to honor the repo's ADR-immutability precedent (when
ADR-0010 superseded ADR-0005 it left ADR-0005 "immutable and unedited", recording the relationship only
in the new ADR). The refine/rename relationships therefore live only in the new ADRs (0013/0017
`Refines: ADR-0005` headers; 0015 records the Prospect->Person rename); the immutable ADRs were not
touched. This adjusted ADR-0015's Consequences wording and tasks 0.5/4.5 - a promotion-mechanics change,
not a design change (the rename/refine decisions are unchanged). The six ADRs were promoted to docs/adr/
with `v:` anchors stripped and Status set to accepted; the change's adr/ originals were moved out.

