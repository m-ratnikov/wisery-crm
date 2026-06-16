# Verification record - adr-signal-only-scoring

Gate run 2026-06-13 per docs/verification-gate.md. High-stakes: yes (ADR draft; promotion writes immutable canon).

## Artifacts covered (git hash-object at record time)

| Artifact | Hash |
|---|---|
| adr/0022-signal-advisory-is-the-only-score.md | 00d3dd3a322c856eea9aa5b65d5aaebfca87b70c (post-sign-off; the gated content hash was 3ab492fad96dea3b414bc201f4fb36701127e650, the only delta being the Status line flipping proposed -> accepted) |
| system-design.md | df73bf5e6cfcff6276010cf33790e26dc617a26d |
| domain-model.md | 86c176a0ccb990fa0b3addca05da35e42e9be8c8 |
| use-cases.md | 8ac4207fcc51c9e61e9ed16a27bf868f9cd74bd9 |
| proposal.md | 14f4c74fde48b11a928a21f7ff3b9c2dedfef7b4 |
| deployment.md | 7e012663c9519ce433e39ea8d4ed17c10aa272f9 |
| tasks.md | 63f4fe05a5b86ba74e09c8d1a847796097ba77a3 |

## Stage 1 - groundedness ledger

Three ledger passes (adr/0022, system-design.md, domain-model.md). First round: domain-model clean; adr/0022 blocked (2 anchor issues), system-design blocked (4 anchor/fact issues - the false "one edge re-labeled" L1 claim, the missing `normalize` in the canon L2 worker-list quote, a mistagged promotion commitment, an over-claimed ADR-0017 derive). All fixed by the author; delta re-runs clean. After the Stage-3 punch-list edits, a final delta ledger over every edited claim: 19/19 supported, **clean**. No unsupported facts, no underivable claims, no untagged non-trivial claims, no unfalsifiable novel claims.

Sequencing note (not a defect): the companion code change `remove-person-scoring` was implemented before this gate ran, so prior-state facts were verified via git HEAD / canon docs rather than the working tree.

## Stage 2 - panel

Lineups per docs/review-panel.md: atlas + canon + greybeard (adr), atlas + greybeard + pedant + canon (system-design), atlas + canon + pedant (domain-model). Raw verdicts: atlas ship-with-fixes, greybeard ship-with-fixes, canon rework, pedant rework.

## Stage 3 - chair synthesis

**Verdict: ship-with-fixes.** Headline: "the only live contradiction is doc-vs-implementation: ADR-0022 called the future learning-loop anchor 'durable, per-signal' while `signal_advisory` is a mutable upsert; the two rework votes rest on a one-glyph ERD error and a verified false positive."

Contradictions surfaced by the chair: (1) canon's blocker (product-overview.md D5/D7 not named for promotion) was a verified false positive - proposal.md Impact-on-canon and tasks.md group 1 carry those edits; (2) the durability claim was confirmed against the schema and fixed by naming the forfeit instead of the false property.

### Punch list and disposition

| # | Severity | Finding | Disposition |
|---|---|---|---|
| 1 | blocker | "durable, per-signal" D7 anchor vs mutable upsert (atlas + greybeard) | FIXED - ADR names the forfeit (signal_advisory not learning-grade; D7 must introduce its own append-only, version-pinned record); domain-model + use-cases reworded to match |
| 2 | blocker | ERD `SIGNAL ||--o| PERSON/COMPANY` contradicts manual origin (pedant) | FIXED - `|o--o|` both edges; cardinality note updated |
| 3 | major | ADR-0017 rubric-immutability invariant unanchored (atlas) | FIXED - Consequences sentence added; canon domain-model.md reword is promotion task 2.2 |
| 4 | major | ADR-0007 enrichment gate silently overridden (canon) | FIXED - Supersedes header extended + new Decision bullet |
| 5 | major | "fit cue, no schema change" understates rubric-kind polysemy (atlas) | FIXED - qualified in ADR Consequences and system-design decision |
| 6 | major | OutcomeLogged presented as live with no writer (atlas) | FIXED - events row marked NO WRITER / deferred with D7 |
| 7 | major | "canon L2 stands as-is" false (re-score in LLM edge label) (pedant) | FIXED - L2 prose names the label edit; tasks.md 2.3b carries it |
| 8 | major | L3 promotion edits named only generically (pedant, ADR-0006) | FIXED - tasks.md 2.3/2.3b now name the concrete canon line edits incl. the system-context boundary-flow sequence |
| 9-14 | minor | kernel-PersonSubject note, L1 bundling note, config-as-data ERD marker, terminal-transition labels, ADR-0017 two-hop note, dep-cruiser ghost entry | ALL FIXED (ghost `qualify/status.ts` removed from .dependency-cruiser.cjs; depcruise green) |
| 15 | minor | ICP-framed prompt is now the only scorer for all 3 kinds (greybeard) | FOLLOW-UP - kind-aware `triage_score_v2` prompt version, companion/code scope, noted in scorer.ts comment |
| 17-18 | nit | CASCADE verified no-op; rollback wording; sys->db arrow | FIXED (rollback wording honest; arrow unidirectional) |

Mechanical checks after fixes: Mermaid parser 24/24 green; dependency-cruiser green.

## Result

**PASS pending sign-off** - Stage 1 clean, Chair verdict ship-with-fixes with all sign-off-blocking fixes applied and re-grounded. ADR-0022 is high-stakes: a human must check the box below before promotion (the agent must not self-sign).

- [x] sign-off: owner accepted ADR-0022 on 2026-06-13 (Status flipped to "accepted - owner sign-off 2026-06-13") and authorized promotion to docs/adr/. Sign-off captured via AskUserQuestion in the apply session.
