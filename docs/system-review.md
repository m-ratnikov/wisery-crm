# System review (code, at convergence and milestone)

The tier that verifies the **system**, not the change. Per-change `code-review`
([engineering.md](engineering.md)) reads a diff plus its callers - it is structurally
local and cannot see a bug that lives in no single diff. Those bugs live in the **seams**
between independently-built capabilities, where each capability's own tests pass and the
defect is in the composition.

This tier is the code-medium counterpart to the architecture-artifact gate
([verification-gate.md](verification-gate.md)): verification is matched to the artifact's
medium - prose claims get grounding, code gets execution. The verification gate parked the
system-tier code mechanism ("a different mechanism, design later"); this doc is that
mechanism.

**Run it with `/system-review`** (optionally with a git range for convergence mode; no argument
runs the milestone drift pass). The command orchestrates the three lenses plus the chair and
writes the record - it is the code-tier counterpart to `/verify-gate`.

**The bug that motivated it (M1).** Auto-enrich routed `qualified -> enrich` only, but the
wired enrichment adapter is a stub that always rejects, so every prospect stranded at
`qualified` - enrich failed, the next stage never fired, nothing reached the queue. Each
capability was green in isolation. The defect was in the wiring between two of them. No
per-change review could have caught it by construction, because it is in no single change.
It is the same genus as ADR-0009's "strand window" and the ADR-0007 auto-enrich edge.

## What is and is not this tier's job (the read-scope invariant)

The two review tiers are MECE by **read scope**, mirroring how `verify` is whole-tree while
`code-review` is diff-local:

- **Per-change review** may read the change's diff plus its direct callers. Local by design.
- **System review** reads only what **spans changes**: the composition root, the entity
  state machines, and cross-capability rule/constant usage. It is **forbidden from filing
  anything a single-diff review could have caught** - those get pushed back to per-change
  review, never re-litigated here.

Without this invariant the two mechanisms drift into doing each other's work, and the cheaper
local one gets skipped ("the system panel will catch it"), moving defects later and widening
blast radius.

## The success metric: the panel must shrink

This is not a standing tax. Every finding whose fix is a **graph or structural property over
the tree** - a forbidden import, a port pointed the wrong way, a `server-only` leak, a
reachable state with no outbound edge - is closed by **promoting it to a build-enforced
fitness function** (a dependency-cruiser rule or a test), not by re-finding it next time. The
panel's success is **fewer findings next milestone**, because the mechanizable classes got
mechanized.

The recurring human seat is therefore reserved for the **irreducible judgment residue**:
lifecycle and state-machine design, and bounded-context drift - the things no fitness function
can decide. This line - *mechanize what is a graph property; reserve the panel for design
judgment* - is the tier's reason to exist. It is the same principle `engineering.md` already
states for dependency direction ("the one SOLID principle that is mechanically enforceable").

> Promotion-to-fitness-function is the **primary output** of lens A below, not a side note.
> A finding that names a mechanizable rule is closed only when that rule lands in the build.

## The three lenses (orthogonal by failure-locus)

Orthogonality is the whole point. Combining reviewers that hunt **different** failure classes
finds strictly more than any single reviewer - but only when they are conditionally
independent (the submodularity result). Topical lenses overlap and file the same bug three
times; these are cut by **where the failure lives**, so each candidate defect has exactly one
home.

### A. Static composition - structural properties of the wired tree

Does every wire exist and point the right way: composition-root wiring, port direction
(adapters depend on ports, never the reverse), `server-only` / secret residency, and
**fitness-function gaps** (rules that should be build-enforced but are not yet). Mostly
mechanizable; its primary output is a list of fitness functions to write.

### B. Lifecycle reachability - dynamic properties of the entity state machines

Model each entity's lifecycle and prove **every state has a reachable outbound edge under the
real adapter dispositions present in the tree** - a stub that always rejects is the *real*
contract, not the nominal one. Crash, retry, and partial-failure are a **depth modifier** on
this same reachability graph, not a separate lens. This lens **owns the strand class** (the M1
bug; ADR-0009; ADR-0007). It is the irreducible judgment core of the tier.

### C. Invariant and canon consistency - semantic properties

One business rule in one place (knowledge-DRY), derived-vs-stored consistency, and **code vs
the locked ADRs and the domain model** (architecture conformance / drift: the implemented
Current Architecture compared against the Planned Architecture in canon). The spec stays the
source of truth; code is forced to conform to it, not the reverse.

Each lens reads the whole tree but answers a **partition of the question, not a partition of
the files**. The chair owns the union, so any partition overlap surfaces as a contradiction
rather than a silent gap. A lens may fan out into several read-only agents internally when its
surface is large.

## Two triggers, by what each catches

- **Primary - wave convergence.** A seam bug is *born* the moment independently-built
  capabilities first share one tree (the worktree convergence in `engineering.md`; "green in a
  worktree does not mean green after merge"). That is when it is first observable and cheapest
  to fix - the author still has context. Run the full lens panel at convergence, scoped to the
  just-converged delta plus its immediate seams. Detecting emergence belongs at integration,
  not after it.
- **Secondary - milestone.** Drift accumulates over time, not at a single merge. Run a lighter
  whole-system pass at each milestone (M1, M2, ...) for global lens-C conformance and drift,
  **alongside the Stryker mutation pass** (both are the per-milestone, out-of-band sensors).
  Milestone architectural evaluation is the long-standing ATAM checkpoint pattern.

When work is serial (one capability at a time on the spine, no parallel worktrees), the two
triggers coincide at the milestone - which is exactly what happened at M1.

## Method

- **Read-only.** Lenses use read and search only (Read / Grep / Glob). They never run a
  generator, a migration, or any mutation. A reviewer once ran `drizzle-kit` and corrupted the
  migration journal; a reviewer that writes is not a reviewer.
- **The filing bar is the verification.** A finding is admissible only if it carries an
  **exhibited path**: a concrete `file:line -> file:line` trace that reaches the bad state.
  Code is constructible - exhibit-the-path-or-withdraw *is* the check. There is no separate
  adversarial-vote stage; that machinery belongs to the prose gate, where a claim can be
  confidently hallucinated and has no compiler to refute it. Here the compiler and the tree are
  the ground truth.
- **One synthesis (the chair).** Dedupe, rank by severity, **surface contradictions between
  lenses rather than resolving them silently**, reject any finding without an exhibited path,
  and emit one triaged punch list with a single verdict. Reuse the output contract from
  [review-panel.md](review-panel.md): severity / location / claim / why / fix, plus a verdict.
- **Loop, not one-shot.** Fixes are new, unreviewed logic written into exactly the seams the
  panel flagged, and `verify` cannot judge their semantics. So after applying fixes, re-run
  `verify` **and** re-review the fix delta in full context (the surrounding code, callers, and
  the invariants it touches - not the delta alone). Converge on the **materiality bar**: close
  when a pass yields no correctness, conformance, or security finding.
- **Record (lightweight).** Leave a record at
  `docs/reviews/<YYYY-MM-DD>-system-review-<scope>.md`: the reviewed commit
  (`git rev-parse HEAD`), the findings, and their dispositions (fixed /
  promoted-to-fitness-function / accepted-with-reason).
  **No per-artifact hash gating** - this tier promotes nothing to immutable canon (CI re-verifies
  the whole tree on every push), so a stale-hash check would have no consumer. Provenance, not a
  gate.

## The code-tier lineup

The [review-panel.md](review-panel.md) roster is **artifact-shaped**: Pedant audits C4
notation, Tracer checks diagram cross-levels, Rookie reads prose for clarity. Most of it has no
lens on code. The system review reuses only the **medium-agnostic** pieces - the output
contract and the Chair - and dispatches the three lenses above as read-only agents. Do **not**
summon Pedant / Tracer / Rookie here: an agent invoked outside its grounding either abstains
(a wasted dispatch) or manufactures a finding to look busy (the failure `review-panel.md`
forbids). Atlas (boundaries) and a code-oriented Canon (ADR conformance over code, not diagrams)
do carry over, because their lenses are not tied to the diagram medium.

## Why a panel at all, and not only fitness functions

The honest boundary: a fitness function is cheaper and never sleeps, so anything expressible as
a graph property over the tree **should** be one (lens A's job is to keep finding those and
retiring them into the build). What is left - "does this state machine have a design-level dead
end under the adapter behavior we actually ship", "has the implemented structure drifted from
the bounded contexts the canon assumes" - is not a graph property; it is judgment about whether
the system still means what it was designed to mean. That residue is real, it is where the M1
bug lived, and it is what this recurring panel exists to cover. If a milestone's panel finds
only mechanizable defects, the correct conclusion is that the panel should have been a fitness
function - and the fix is to write it.

## Sources

- Combining reviewers that detect different failure classes strictly dominates any single one
  (submodularity of mutual information under conditional independence):
  [Multi-Agent Code Verification via Information Theory, arXiv:2511.16708](https://arxiv.org/pdf/2511.16708)
- Architecture fitness functions as continuous, automated integrity assessment:
  [Fitness Functions - Continuous Architecture](https://continuous-architecture.org/practices/fitness-functions/),
  [Fitness Functions for Your Architecture - InfoQ](https://www.infoq.com/articles/fitness-functions-architecture/)
- Architecture conformance checking / drift (Current vs Planned Architecture):
  [Architecture view-based drift analysis, ScienceDirect S0920548923000557](https://www.sciencedirect.com/science/article/pii/S0920548923000557)
- Milestone (ATAM) checkpoints vs continuous evaluation in iterative development:
  [Architecture evaluation in continuous development, ScienceDirect S0164121221002089](https://www.sciencedirect.com/science/article/pii/S0164121221002089)
- Emergent behavior should be detected at integration, where it first appears:
  [Detecting emergence in engineered systems, INCOSE Systems Engineering 10.1002/sys.21660](https://incose.onlinelibrary.wiley.com/doi/full/10.1002/sys.21660)
