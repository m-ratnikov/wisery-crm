# Verification record - engagement-rework

Gate: docs/verification-gate.md. Stakes: **high** (the three ADRs promote to immutable canon, so human sign-off is mandatory and must not be self-signed).

## Artifacts covered (git hash-object at verification time)

| Artifact | Hash |
|---|---|
| proposal.md | 129870e6082011a307e02c1bac38bf8533116eed |
| use-cases.md | 83643b03ee53009f1e92ed47bf79ad198148fe5d |
| domain-model.md | 15b57bf2b9146c23db2516309a946db058e42a2c |
| system-design.md | 5d1412066d732e04be4fea39d377b42fc11ea989 |
| deployment.md | 1ba75b4553a491a1860a34f9e950d20c7f90f645 |
| tasks.md | 9f2214f232a90d91c81822c6f7764c374d51bc18 |
| adr/0019-generation-and-scoring-on-demand.md | 16ae49921bea94712bbb71fbed181b91d3835ad3 |
| adr/0020-configurable-pipelines-for-person-status.md | c16030b37fd5fa7ab1656ca04c7500b27f367462 |
| adr/0021-linkedin-message-entity.md | d0f6bcce65139eab03607d41357988be700ae59c |

Re-run the gate if any artifact is edited after these hashes (the promotion task treats a hash mismatch as stale).

## Mechanical checks

- `tests/mermaid.test.ts` + `tests/arch-links.test.ts`: 48/48 pass (every diagram in the change + docs parses; all links resolve). Green.

## Stage 1 - Ground (ledger)

Multiple passes across the bundle's evolution. The final sweep of the scoring model verified the load-bearing facts against source: the `scorings` NOT NULL `rubric_id`/`score`/provenance contract and the absence of a `provenance` column today (so it is a real schema addition); `signal_advisory`'s nullable score and missing `rubric_id`; that only the `icp` rubric is seeded (so a `content -> peer` approval with no `peer` rubric is a real exhibited path, grounding the conditional-Scoring branch); ADR-0017's company-rubric-no-Scoring exception; ADR-0010's affirmative "manual prospect flows through qualify" decision (grounding the supersede-in-part relabel); and that `outcomes.score_at_time` is a bare smallint with no provenance (grounding the learning-loop invariant as recorded future work). All schema/derivation claims supported.

Note on two recurring ledger "blocked" rows: a sub-agent twice checked `docs/architecture/domain-model.md` / `system-design.md` (the **canon**, which is intentionally not updated until Phase 1 apply) instead of the change-folder views. The change-folder views are internally consistent (atlas and canon both confirmed the rubric-kind-filtered qualification read is phrased consistently across ADR-0019, domain-model, and system-design). These are false positives against not-yet-promoted canon, not real ungrounded claims.

## Stage 2 - Challenge (panel: atlas, greybeard, pedant, canon)

Three review rounds as the design converged.

**Round 1 (initial bundle) -> rework.** Convergent blockers: the original "copy advisory score forward into a Scoring" was schema-impossible and would have polluted the ADR-0017 learning loop; ADR-0019 mislabeled a supersession of ADR-0013; six C4 L2 notation regressions (web+worker drawn as two containers, bare edges, missing nodes, no legend, component-level sequence participants). All reworked.

**Round 2 (reworked bundle) -> greybeard ship; atlas/pedant/canon ship-with-fixes.** Every Round 1 blocker confirmed resolved; only minor/nit findings, all applied (peer-type qualification scoping, DB-enforced composite FK for pipeline membership, C4 label alignments, atomic-promotion gate in tasks.md, deleteQueue runbook).

**Owner sign-off feedback reshaped the scoring model**, requiring Round 3. Per owner directive: a Queue-created person must KEEP its initial assessment score (so approval now promotes the advisory score into the person's initial Scoring), and manually-created persons must NOT be auto-scored (so the `qualify-prospect` worker is retired and manual entry is scored only on demand).

**Round 3 (revised scoring model) -> canon ship; atlas/greybeard ship-with-fixes.** This re-challenge caught real consequences of the owner directive and they were all resolved:
- (atlas/canon/greybeard) the advisory->Scoring promotion needed a real schema seam - added `scorings.provenance` (`llm | advisory`) with an `advisory` sentinel in the NOT NULL provenance columns, named in the Decision.
- (atlas) `Outcome.score_at_time` binding could still pollute the learning loop through the outcomes table - recorded the two-table exclusion invariant (advisory Scorings and outcomes bound to them both excluded; exact D7 query deferred as future work).
- (greybeard) no `peer` rubric is seeded, so a `content -> peer` approval had no `rubric_id` to resolve and would fail the NOT NULL FK - the initial Scoring is now conditional on an active rubric of the kind existing (else the person reads `unassessed`; the approval never fails).
- (canon) removing manual auto-score reverses ADR-0010's stated decision -> relabeled Supersedes-in-part (not Refines); promotion scoped to person/peer (company writes no Scoring, per ADR-0017).
- (atlas) qualification read must filter by buyer-rubric kind, not just "latest" - made consistent across all three views; the `-1` sentinel classified `below_bar` by rule; the `outcomes.draft_id` / `drafts`-table disposition named (table frozen, not dropped; outcome-to-Message binding deferred).

## Stage 3 - Synthesize (chair verdict)

**Verdict: ship, pending human ADR sign-off.**

Headline: the bundle's spine - on-demand generation replacing the auto drafting stage, one unified Queue, configurable pipelines superseding ADR-0008, Message/Comment as two entities - was affirmed sound across all three rounds. The scoring model went through two owner-driven reshapes; the gate caught a schema impossibility and a learning-loop pollution hole each time and both are now resolved with recorded seams (`scorings.provenance`, the conditional promotion, the two-table exclusion invariant). The supersede/refine graph for ADR-0019 (supersedes-in-part ADR-0013/0007/0017/0010; refines ADR-0005/0018) is honest and complete; the immutable ADRs are declared upon, never edited.

Triaged punch list carried into the code slices (not gate blockers - the ADRs/tasks record them): the `scorings.provenance` migration + `advisory` sentinel (Slice 1); the conditional initial-Scoring promotion and the prospect-only re-score (Slice 1/3); `deleteQueue("draft")` and `deleteQueue("qualify-prospect")` (Slice 1); the three-migration TTY-safe enum->FK + idempotent seed + composite FK (Slice 2); the deferred `outcomes.message_id` binding (with the future learning loop).

## Human sign-off (mandatory - high-stakes)

- [x] sign-off: APPROVED by the product owner (Michael Ratnikov) on 2026-06-08 via the sign-off gate - promote ADR-0019, ADR-0020 (supersedes ADR-0008), ADR-0021 to immutable canon. (Recorded by the agent from the owner's decision; not self-signed.)

### Owner decisions captured (2026-06-08)

- Manual entry no longer auto-scores; Queue-created people keep an `advisory`-provenance initial assessment Scoring (folded into ADR-0019).
- Enum->FK backfill map confirmed (pre-prod, re-placeable).
- Default pipeline vocabulary chosen: the seeded "LinkedIn outreach" pipeline is `Cold, CR Sent, CR Accepted, FU Sent, Conversation, Discovery call, Not Interested, Ghosted, Proposal Sent, On Hold` (entry status `Cold`); folded into ADR-0020 and the domain-model lifecycle.
