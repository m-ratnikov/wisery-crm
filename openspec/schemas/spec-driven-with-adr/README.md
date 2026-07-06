# spec-driven-with-adr - the default lane

This is the **default** workflow schema (set as `schema:` in `openspec/config.yaml`):
code + spec deltas + an optional ADR in a single change. It is the built-in
`spec-driven` flow (`proposal -> specs -> design -> tasks`) with one `adr` step
inserted before tasks (`proposal -> specs -> design -> adr -> tasks`).

The `adr` step is **self-skipping**: it runs on every change, but writes a new ADR
to `docs/adr/*.md` only when a durable architectural decision actually surfaces. Most
changes (a bugfix, a rename, a tweak inside the existing design) produce no new ADR,
and the step still completes. So this one schema covers everything from a one-line fix
to a durable-but-uncontested decision, without an up-front tier choice.

It deliberately does NOT draw C4 views and does NOT re-slice the descriptive canon
(`docs/architecture/*`, `docs/product-overview.md`) synchronously. That heavier work
belongs to the architecture-lane `spec-driven-architecture` schema.

## When to leave this lane

Escalate to `spec-driven-architecture` (via `--schema`) only when the decision needs
C4 views, reshapes persisted data, supersedes a still-load-bearing accepted ADR, or is
flagged contested. See the two-lane table in `CLAUDE.md` ("Spec workflow") for the full
rule and triggers. When in doubt, stay here.

## Review

`npm run verify` + a `code-review` pass on the diff. **If the change wrote a NEW ADR**,
also run the light ADR gate on it before archive (Stage-1 `ledger` + one `canon`
reviewer + human sign-off; the full `/verify-gate` panel if it supersedes an in-force
ADR). A change that writes no ADR needs no gate. See `docs/process/verification-gate.md`.

## Canon impact (the guardrail)

Because this schema does not re-slice the descriptive canon, each ADR it writes MUST
carry a one-line **"Canon impact"** field naming the `docs/architecture/*` /
`docs/product-overview.md` sections the decision makes stale (or "none"). A later
`/system-review` run batch-reconciles the canon named in the "Canon impact" lines of
ADRs accepted since the last review. That reconciliation is what keeps the lane honest:
the ADR records the debt, the system review pays it down.

## Provenance

Parked 2026-05-21 on an organizational-purity call (ADRs owned solely by
`spec-driven-architecture`), re-enabled 2026-06-13 once the cost of routing every
durable decision through the heavy schema was felt, then made the **default lane**
2026-07-02 by merging the old Tier-1 (mechanical) and Tier-2 (durable) tiers into one
lane with a self-skipping ADR step. Reasoning:
`docs/explore/2026-07-02-merge-tier-1-and-2.md`,
`docs/explore/2026-06-13-dev-process-optimization.md` (and the original parking note
`docs/explore/2026-05-21-architecture-folder-organization.md`).
