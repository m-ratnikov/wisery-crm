# Verification record - prospect-manual-origin

Gate run per `docs/verification-gate.md` on the architecture artifacts of this change. High-stakes: it promotes ADR-0010 to immutable canon, so human sign-off is mandatory and must not be self-signed.

## Artifacts covered (content-pinned)

`git hash-object` captured at gate time; re-run the gate after any edit, or the promotion task must treat this record as stale.

| Artifact | git hash-object |
|----------|-----------------|
| proposal.md | 272d8040bfe312b1998e8b2e3e3bab42cf613bcc |
| use-cases.md | a9c694728191d2e26e078ec160f0bb89c303ae3b |
| domain-model.md | 86754bc451c275a2cca7741426b3bf3e124a627f |
| system-design.md | 6f1d371a346b59aca36b26ff5a0d09c4c275d02c |
| deployment.md | 67b410bc2fbc2ad96f71bea4a4cf98ac1bee7014 |
| tasks.md | 41335d35435a08c58266fbe3f30434d6c44aa6dd |
| adr/0010-prospect-origin-signal-or-manual.md | 6d65d22a898b3d1bfa0d0006281b36ac0bf235e7 |

## Stage 1 - Ground (ledger)

**CLEAN** (after author fixes). Initial sweep returned BLOCKED on two claims; both fixed and re-verified clean:
- The manual-add qualify enqueue was wrongly cited as ADR-0009's atomic in-transaction handoff. ADR-0009 classifies user-triggered enqueues as fire-and-forget; corrected across domain-model.md, system-design.md.
- A stale `Refines: D5` tag in the ADR header (copied from ADR-0005) was removed; tasks.md no longer claims ADR-0010 refines D5.
No unsupported/unverifiable claims remain.

## Stage 2 - Challenge (panel)

Lineup: domain-model -> atlas, canon, pedant; adr -> canon, atlas, greybeard. First pass returned **rework** (atlas, greybeard, pedant) / ship-with-fixes (canon). Author revised all artifacts. Re-review: **all four SHIP**.

Blockers/majors fixed and re-verified against the code:
- The "no new path / coalescing seam" overclaim, contradicted by the signal-keyed pipeline (read-models `innerJoin(signals)`; `qualifySignal` loads the signal and creates the prospect; scorer/drafter consume `SignalRow`; `loadActionableProspect` throws on missing signal). Now an honest "Consumer impact" footprint in domain-model.md + matching ADR Consequences: a `PersonIdentity` DTO replacing the `SignalRow` dependency, a prospect-keyed qualify entry + `prospectId` idempotency, inner->left joins, and a re-qualify action.
- The CHECK over-constraint and 2-arm trap, replaced with the per-origin, future-origin-safe predicate, no longer forcing `name IS NULL` on signal rows.
- Supersede-don't-restate: ADR-0010 supersedes only ADR-0005's totality clause and references (does not restate) the fan-out/score-per-person/dedup, keeping the cardinality in a single home.
- Notation: ERD `SIGNAL |o--o{ PROSPECT`, consistent identity-column annotations, events header flags the revised `ProspectScored`, payload wording restored.
- Promotion fidelity: tasks now name the stale canon to purge (domain-model `ProspectScored` "signal-derived person"; product-overview "fanned out from a signal" noun).

## Stage 3 - Synthesize (chair)

**Verdict: ship-with-fixes.** Headline: all four lenses and the groundedness gate are clean and both prior blockers are fixed and re-verified; "with-fixes" reflects only two nits carried into the code change, neither gating promotion. No live contradiction (the prior canon-vs-atlas tension over the overclaim was resolved at the source via explicit supersession + named footprint, not averaged away).

Punch list (carry-to-code-change guidance, not gate blockers):
- NIT (greybeard): if the CHECK is authored `NOT VALID`, keep the column-adds and the constraint as separate migration statements so the `VALIDATE` step is cleanly ordered.
- NIT (atlas): the per-origin CHECK deliberately permits a signal-origin row to also carry manual identity columns, leaving room for a future cross-origin merge - internally consistent, recorded for traceability, not actionable.

## Sign-off

Gate result: **PASS** (Stage 1 clean; chair verdict not rework; high-stakes sign-off line present below for a human).

- [x] sign-off: APPROVED by Michael Ratnikov (user), 2026-06-04 - explicit human sign-off recorded; ADR-0010 cleared for promotion to immutable canon. (Recorded on the user's instruction, not self-signed by the agent.)
