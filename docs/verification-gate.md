# Verification gate

A repeatable gate run on `spec-driven-architecture` artifacts before they are promoted to
canon. It catches two failure classes that the design panel alone missed once already: **fabricated
or ungrounded claims** (hallucination) and **unsound design**.

**Scope.** Applies to `spec-driven-architecture` artifacts only (proposal, use-cases,
domain-model, system-design, deployment, adr). It does NOT apply to the default `spec-driven`
(code) schema - code is verified by typecheck, tests, lint, and spec-conformance, a different
mechanism (parked, design later). Verification is matched to the artifact's medium: prose claims
get grounding; code gets execution.

This is grounded in published practice, not invented here (see Sources): the extrinsic/intrinsic
hallucination split, reference-free detection (SelfCheckGPT, Chain-of-Verification), RAGAS-style
atomic-claim faithfulness checking, and human-in-the-loop for high-stakes outputs.

## The spine: anchor every non-trivial claim by type

Each claim carries an **anchor** - an HTML comment, so it is invisible when rendered and cannot
collide with Mermaid `[...]` node labels or markdown `[links](...)`:

| Anchor | Type | Must carry | Verified by |
|---|---|---|---|
| `<!-- v:fact <source> -->` | extrinsic - external truth | a checkable source (docs, lockfile, URL) | source check |
| `<!-- v:derives <ADR-N / D-N / section> -->` | intrinsic - follows from canon | the premise it follows from | re-derivation |
| `<!-- v:decision -->` / `<!-- v:assumption -->` | novel - invented here | a falsifiable invariant or fitness function in the prose; else abstain | re-derivation + human |

A claim with no anchor is treated as unsupported at the gate. If a claim cannot earn an anchor, do
not write it (abstain).

### Anchored source vs clean view

The anchored doc is the **single source of truth** - the one humans edit and the gate hashes and
verifies. The clean canon view is **generated** from it at promotion by stripping every
`<!-- v:... -->` comment (regex `<!--\s*v:.*?-->`); it is build output, **never hand-edited**.
Hand-maintaining two copies would drift - the exact failure this avoids. Because the anchors are
comments, a rendered preview of the anchored source is already clean; the strip only removes them
from the promoted `.md` for canon hygiene.

## The four stages

0. **Generate (prevent).** Author under the taxonomy. The architecture schema's artifact
   instructions (`system-design`, `adr`) carry the rule, so generation is grounded by default.
1. **Ground (detect fabrication)** - the `ledger` agent. Decompose the artifact into atomic
   claims and verify each by type:
   - `[fact]` -> check the cited source resolves and actually supports the claim (web, docs, lockfile).
   - `[derives]` -> independently re-derive: does it follow from the named premise?
   - `[decision]`/`[assumption]` -> is it falsifiable and labeled as a choice, not asserted as fact?
   Output: a groundedness ledger. **Blocks** on any unsupported fact or underivable novel claim.
2. **Challenge (detect bad design)** - the panel, lineup by artifact type. Runs only after Stage 1
   is clean - never challenge a hallucination. Output: findings on the shared contract.
3. **Synthesize + gate** - `chair` dedupes, ranks, and surfaces contradictions. **Human sign-off
   is mandatory for ADRs and anything promoting to immutable canon.**

**The caveat that drives the design:** consistency / self-check methods catch claims the model is
*unsure* of; they MISS confident, systematic errors. The pg-boss `LISTEN/NOTIFY` claim was
confident-wrong and would have passed a self-check - only external source-checking caught it. That
is why `[fact]` claims get external grounding, not self-consistency.

## Enforcement (no vendor or apply changes)

The gate is a **section-0 gate task** in the change's `tasks` artifact. The `spec-driven-architecture`
schema's own `apply` instruction already runs section-0 gate tasks first and pauses on failure, so
the gate is enforced **without touching the vendor `/opsx:apply` command or the schema's apply
behavior**. `config.yaml` is untouched.

Run the gate with `/verify-gate <artifact>`. It writes a record to
`openspec/changes/<change>/verification.md` carrying each artifact's `git hash-object` at
verification time. The promotion tasks require a record that is passing and whose hash matches the
artifact's current content - edit the artifact after verifying and the record is stale, so re-run.

**Pass** = no unsupported claims (Stage 1) + Chair verdict not `rework` (Stage 3) + human sign-off
where the artifact is high-stakes.

## Panel lineups by artifact (Stage 2)

- `system-design` -> atlas, greybeard, pedant, canon
- `adr` -> canon, atlas, greybeard
- `domain-model` -> atlas, canon, pedant
- others -> canon at minimum

See `docs/review-panel.md` for the agent roster.

## Sources

- Extrinsic/intrinsic split and technique landscape: [Comprehensive Survey of Hallucination Mitigation, arXiv:2401.01313](https://arxiv.org/abs/2401.01313)
- Reference-free, zero-resource detection: [SelfCheckGPT, arXiv:2303.08896](https://arxiv.org/abs/2303.08896)
- Decoupled self-verification: [Chain-of-Verification, arXiv:2309.11495](https://arxiv.org/abs/2309.11495)
- Atomic-claim faithfulness: [RAGAS / Evaluating RAG](https://www.vectara.com/blog/evaluating-rag)
- Correctness is not faithfulness: [arXiv:2412.18004](https://arxiv.org/pdf/2412.18004)
- Abstain when ungrounded: [Grounded attribution and learning to refuse, arXiv:2409.11242](https://arxiv.org/pdf/2409.11242)
