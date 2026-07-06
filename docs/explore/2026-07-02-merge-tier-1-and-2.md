# Merge Tier 1 and Tier 2 into one default lane (2026-07-02)

## Context

The workflow had three tiers (provenance: `2026-06-13-dev-process-optimization.md`):

- Tier 1 mechanical -> `spec-driven` (default), no ADR.
- Tier 2 durable-but-clear -> `spec-driven-with-adr` (`--schema`), one ADR + light gate.
- Tier 3 contested/complex -> `spec-driven-architecture` (`--schema`), full cascade + gate.

The Tier 1 / Tier 2 boundary was the weakest cut. It forced an up-front classification
("is this a durable decision?") before the change had taken shape, the answer was often
ambiguous, and getting it wrong either way was cheap. That is friction with little payoff.

## Decision

Collapse Tier 1 and Tier 2 into a single **default lane**, and keep the architecture lane.

- **Default schema is now `spec-driven-with-adr`** (`openspec/config.yaml`).
- The schema's `adr` step is **self-skipping** - it already completes without writing a new
  ADR when nothing qualifies (it only needs `docs/adr/` to be non-empty, which it always is
  after ADR-0001). So the LLM decides, per change, whether a durable decision surfaced and
  writes an ADR only then. No schema restructuring was needed; the "optional ADR" behavior was
  already built into the step's instruction.
- **The ADR gate is now artifact-triggered, not tier-declared.** If a default-lane change
  wrote a NEW ADR, run the light check (Stage-1 `ledger` + one `canon` reviewer + human
  sign-off) before archive; if that ADR supersedes an in-force ADR, the full `/verify-gate`
  panel. If the change wrote no ADR, no gate - `npm run verify` + `code-review` is the whole
  check. The trigger moved from the human's up-front label to the presence of the ADR.
- The **architecture lane** (`spec-driven-architecture`) is unchanged. Its trigger (reshapes
  data, supersedes a load-bearing ADR, introduces a boundary future changes live with, or
  contested) is a genuine, deliberate call that earns the explore note + C4 + full panel.

## Why keep the gate instead of dropping it

The developer signs off on the ADR anyway, but the `canon` reviewer catches "this ADR quietly
contradicts an accepted one," which is exactly the failure a human is worst at (it needs all
prior ADRs held in mind at once). Keeping the check artifact-triggered removes the up-front
classification (fewer decisions) while preserving the safeguard on the most permanent artifact.
Net: three tiers become two lanes, and the developer experience for the common case is
identical to the old Tier 1 (propose -> apply -> verify -> code-review -> archive).

## Changed

- `openspec/config.yaml`: `schema: spec-driven-with-adr`; header comment -> two-lane model;
  relaxed the `design` rule (a durable decision is now recorded inline via the adr step).
- `openspec/schemas/spec-driven-with-adr/schema.yaml`: description softened; `adr` instruction
  states skipping is the norm on the default lane.
- `openspec/schemas/spec-driven-with-adr/README.md`: rewritten as the default lane.
- `CLAUDE.md` "Spec workflow": three-tier table -> two-lane table + trigger paragraph.
- `docs/process/verification-gate.md`: Scope + Proportionality re-triggered on ADR presence.
- `docs/process/engineering.md`: enforcement cadence + trigger diagram node -> two lanes.
- `docs/process/system-review.md`, `docs/roadmap.md`, `docs/harness-overview.md`,
  `docs/harness-overview-v2.md`: tier language reconciled to the two lanes.
