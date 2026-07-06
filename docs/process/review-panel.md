# Architecture Review Panel

A roster of challenger agents for stress-testing architecture artifacts (C4 diagrams,
ADRs, system-design, deployment). Each agent is one adversarial lens with a memorable
nickname you use to summon it. Invoke a single agent by nickname, pick a prebuilt lineup,
or run the full panel.

Every agent in this roster is a wired subagent under `.claude/agents/`. If a lens you want
is not here, it is not summonable - add the agent first, do not reference a nickname that
has no backing definition.

> **Scope: this roster reviews artifacts, not code.** The code-medium counterpart is the
> **system review** ([system-review.md](system-review.md)), which runs at convergence and
> milestone over the wired tree. It reuses only the medium-agnostic pieces here - the output
> contract below and the Chair - and dispatches its own three code lenses. Pedant is
> artifact-shaped (it audits C4 notation) and has no lens on code; do not summon it against a
> codebase. Atlas and a code-oriented Canon do carry over, since their lenses are not tied to
> the diagram medium.

The roster has two halves, designed to clash:

- **Conformance reviewers** (Canon, Pedant) check that the artifact faithfully renders and
  honors decisions already made (ADR-0001, the stack, the locked decisions D1-D7).
- **First-principles challengers** (Atlas, Greybeard) question whether those decisions are
  right in the first place.

When a conformance reviewer and a first-principles challenger disagree (Canon says "conform to
ADR-0001"; Atlas says "ADR-0001 should not hold at L2"), that contradiction is the headline
finding, not noise - it means a decision is genuinely live and must be defended or superseded.

## How to use

- "Involve Atlas and Greybeard" - dispatch just those two against the named artifact.
- "Run the decision-review lineup" - dispatch a prebuilt set (see Lineups).
- Any agent may return "clean in my lens." Manufacturing findings to look busy is a failure.

## Output contract (every agent obeys this)

Each finding is one block:

- **severity**: `blocker` | `major` | `minor` | `nit`
- **location**: file + the node / edge / line it concerns
- **claim**: what is wrong
- **why**: the consequence if it ships unaddressed
- **fix**: a concrete suggested change (not "reconsider X")

End with a one-line **verdict**: `ship` | `ship-with-fixes` | `rework`, and name the single
most important finding.

---

## The roster

### Atlas - Solution Architect (boundaries) `[first-principles | Opus]`

Questions the seams themselves, not how they are drawn. Brings coupling/cohesion, bounded
contexts, Conway's law, and reversibility to bear, and is explicitly allowed to recommend
**superseding an ADR** (which then goes through the ADR process).
- **Challenges**: where the container/module boundaries fall; whether "one process, two roles"
  is the right cut; whether the provider abstraction (D4) is essential or premature; whether
  binding the queue to the app's Postgres couples two things that should be independent;
  whether today's seams map to the bounded contexts that will emerge.
- **Reads**: full canon - `docs/architecture/*`, `docs/adr/*`, `docs/product-overview.md`.
- **Signature catch**: the "no-rewrite peel to worker.ts" only holds if web and worker share
  nothing but Postgres; demands that be stated as an invariant or the boundary is unproven.
- **Also**: steelmans every rejected alternative (the devil's-advocate lens) as part of its job.
- **Tension with**: Canon (fidelity vs first principles).

### Greybeard - Senior Technologist (technologies) `[first-principles | Opus]`

The deeply experienced engineer who knows each named technology's real failure modes and
alternatives. **Must verify against installed versions and `node_modules/next/dist/docs/`**
(this is "NOT the Next.js you know" - training-data knowledge is disqualified here) and use
web search for the non-vendored libs. Focuses fire on the least-reversible bets, ranked by
reversibility x blast radius; does not rubber-stamp safe choices (Zod, pino, TS).
- **Challenges**: pg-boss hosted inside Next via `instrumentation.ts register()` (assumes one
  long-lived `next start`; dies on serverless/edge); Postgres as both store and queue (a
  transaction-mode pooler breaks the session-mode LISTEN/NOTIFY pg-boss needs - a provider
  selection constraint); pg-boss vs Graphile Worker / Inngest / Temporal; Puppeteer vs
  Playwright vs a managed browser service.
- **Reads**: `package.json`, lockfile, `node_modules/next/dist/docs/`, ADR-0001, web search.
- **Tension with**: Canon (the stack is locked vs is the stack right).

### Canon - Decision & ADR Fidelity Auditor `[conformance | Sonnet]`

The canon guardian. Confirms the artifact honors every accepted ADR and locked decision, and
flags any decision the artifact makes silently that *should* be an ADR.
- **Challenges**: divergence from ADR-0001; contradictions with D1-D7; undocumented durable
  decisions hiding in a diagram.
- **Reads**: `docs/adr/*`, `docs/product-overview.md` decisions, the artifact under review.

### Pedant - C4 Discipline Auditor `[conformance | Sonnet]`

The notation stickler. Enforces C4 level purity, a legend, a protocol on every edge, and the
container test ("something that has to be running"). This is the lens that catches
components-drawn-as-containers.
- **Challenges**: mixing C4 levels in one diagram; edges without protocols; missing legend;
  inconsistent abstraction.
- **Reads**: the diagram and the C4 method only.

### Chair - Moderator / Synthesizer `[orchestration | Opus]`

Not a reviewer. Runs after the others, dedupes overlapping findings, ranks by severity,
**surfaces contradictions between agents rather than resolving them silently**, and emits one
triaged punch list with a single overall verdict.
- **Reads**: every agent's findings for this artifact.

---

## Lineups

Named sets so you can summon by intent rather than listing nicknames each time.

- **Decision review** (before `apply` / promotion): `Canon` + `Atlas` + `Greybeard` + `Chair`
- **Notation check** (C4 diagrams): `Pedant`
- **Full panel** (major milestone): everyone, `Chair` synthesizes

Need a security, resilience, or fresh-reader lens? Those are not wired here. Reach for the
`/security-review` skill for trust-boundary review, and raise resilience or clarity concerns
through Atlas (boundaries) or a directed ad-hoc agent rather than a phantom nickname.

## Conventions

- One artifact named per run; agents critique it, they do not edit it.
- Agents run in parallel (they are independent); `Chair` runs last.
- Each agent's grounding doc is its only authority - findings cite it.
- Nicknames are the control handles; rename freely, the role definitions are what matter.
