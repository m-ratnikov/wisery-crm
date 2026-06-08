# ADR-0017: Type-keyed advisory rubrics (icp | peer | company)

- Status: accepted
- Date: 2026-06-06
- Refines: ADR-0005 (rubric generalized to one-active-per-kind; the per-person Scoring and its rubric-version binding are preserved)
- Source: docs/explore/2026-06-06-content-marketing-engagement.md; system-design.md; domain-model.md

## Context

The qualifier scores a person 1-5 against a single ICP `Rubric` (the buyer rubric), with at most one active rubric. Universal triage (ADR-0013) wants an advisory hint per signal, but a signal's intent varies: a buyer signal wants buyer-fit, a peer/content signal wants amplifier-fit, a company signal wants firmographic-fit. Scoring a peer or a company against the buyer rubric is meaningless and would mislabel them. The existing rubric machinery (criteria as versioned config-as-data, read by qualification, immutable once scored against) is the right mechanism to reuse rather than inventing a parallel one.

## Decision

We will add a `kind` to `Rubric` (text + Zod: `icp` | `peer` | `company`, default `icp`) and run, at triage, the rubric whose kind matches the signal's intent; its result is advisory only. The existing single-active constraint (`rubric_one_active_uq`) becomes one-active-per-kind (a partial unique index over `(kind)` where active), and the qualifier's "the active rubric" selection becomes kind-aware - it reads the active rubric for a given kind rather than the single global active row. The durable per-person `Scoring` (ADR-0005) continues to bind to the rubric version it was taken against and is created at/after approval against the rubric matching the person's type - the ICP rubric for `type = prospect`, the peer rubric for `type = peer`, so a peer is scored too (smart LLM filtering), just never against the buyer rubric. The company rubric drives the triage advisory hint only and is not persisted as a `Scoring` this slice, because a company is not a `Person` and `Scoring` binds to a person until company-to-people expansion lands.

## Consequences

Easier: each signal intent gets a meaningful advisory hint from one reused, config-as-data mechanism; adding a future intent is a new rubric kind, not a new scorer. Harder/accepted: the one-active constraint and the qualifier's rubric selection become kind-aware; the default `icp` keeps existing rubric rows valid with no backfill. The rubric-immutability-once-scored invariant (the learning-loop guarantee) is unchanged and now holds per kind. The advisory triage pass computes a hint only and writes no `Scoring` row - no rubric-version binding, no learning-loop entry; only the post-approval `qualify` step persists a `Scoring` (so the advisory read can never pollute the ADR-0005 learning loop). This generalizes the qualifier - it refines ADR-0005's rubric scope (single-active to one-active-per-kind) without reversing its per-person scoring or rubric-version immutability, and does not touch ADR-0008.
