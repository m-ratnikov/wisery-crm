# Explore: anchor-view wireframes

- Date: 2026-05-26
- Decision: none yet (design not locked). Distills into the `review-queue` capability spec when a
  screen reaches `locked`; an ADR only if a load-bearing UI decision emerges.
- Method: spec-kit (clarify + research), adapted

## Question

How do we bring UI wireframes into the design, and specifically what are the **assisted-action
affordances** of the review/approve queue - the open question parked in
[product-overview.md](../product-overview.md#9-open-questions) ("Exact 'assisted action' UI
affordances")? The architecture already fixes the three anchor views as L3 components; the UX of
those screens was unspecified.

## Assumptions and constraints

- Three hand-built anchor views only (review/approve queue #2, prospect list #3, ICP/source config
  #1); everything else is jobs + generative output (the thesis).
- The action stays human (D2): the queue hands over a draft + dossier + a deep link; the human
  sends manually. Nothing in the UI sends.
- Outcomes are logged against the original score from day one (D7).
- Stack is fixed: Next 16 (RSC-first) + React 19 + Tailwind 4 (CSS-first `@theme`, no component
  library); strict verify gate (depcruise, jscpd `threshold: 0`, per-file coverage, build).

## Clarifications (clarify pass)

1. **Medium for wireframes?** -> In-repo clickable React/Tailwind. (Rejected v0/Figma/Claude
   Artifacts as the *code* source - see findings; usable only as throwaway visual idea generators.)
2. **Relationship to the verify gate / real views?** -> Isolated, non-gated prototype that
   graduates later, rather than production-grade-from-the-start or third-party-first.
3. **First pass width?** -> The review/approve queue first, deep (highest judgment; it is the
   surface tied to the open question).
4. **Linking model when a wireframe spans many specs/components, and the whole-CRM prototype?**
   -> Many-to-many via a registry; the whole-app prototype anchors to the Primary journey, not a
   capability (see Outcome).

## Unknowns

- NC1: assisted-action affordances of the queue (the parked open question). *Being explored by the
  wireframe itself.*
- NC2: how a wireframe embeds into the spec + architecture trail without polluting C4 canon.
  *Resolved* - see Outcome.
- NC3 (deferred): the affordances of prospect list and ICP/source config; cross-screen flow.

## Options considered

| Medium | Pros | Cons |
|---|---|---|
| ASCII in markdown | versioned, zero tooling, fits doc culture | not clickable; weak at real layout |
| Figma (MCP) | high-fidelity visuals, shareable | outside git; drifts from spec; hand-rebuild to code |
| v0 / Lovable | fast, good-looking, clickable | emits Tailwind 3 + JS config + shadcn + heavy `'use client'`; recurring re-port tax against this stack |
| Claude Artifacts | quick single-screen look | one file, CDN Tailwind, not this repo's tokens |
| **In-repo React/Tailwind** (chosen) | real tokens, zero re-port, clickable, graduates in place | slower first pixel; plainer look |

Build path: **isolated `src/app/prototype/` (gate-excluded), graduate locked screens into `(anchor)`**
- chosen over production-grade-now (premature) and third-party-first (re-port tax).

## Key findings

- The chosen-stack mismatch is the deciding factor: Next 16 + Tailwind 4 (CSS-first, no shadcn) is
  exactly what third-party generators get wrong, so their value is the *design*, not the *code*.
  (Grounded in `package.json`, `src/app/globals.css`.)
- A screen does not map to one capability. The queue surfaces the dossier (enrichment), the draft
  (drafting), the score (qualification) and outcome logging (tracking) on one view - so the
  screen/capability relationship is **many-to-many**. (Grounded in `product-overview.md`,
  `system-design.md` L3.)
- OpenSpec already has the linking hook: a capability spec MAY carry an `## Architecture` section
  that links its architectural home. Extending it to also link the wireframe screen is one clause,
  auto-injected into every future capability spec. (Grounded in `openspec/config.yaml`.)
- Architecture canon is guarded by `tests/canon-integrity.test.ts`, which validates that every link
  in a canon doc resolves and that required sections are present. A wireframe pointer is safe as a
  single supplementary link to the prototype registry; per-component links would couple canon to
  volatile sketches. (Grounded in the test + ADR-0006's "L3 is a skeleton of seams".)

## Outcome

Built the **review/approve queue** as a clickable in-repo wireframe (`/prototype/review-queue`):
selectable prospect list, dossier + signal context, an editable draft tagged with its
`prompt_version`, copy + Open-in-LinkedIn deep link (assisted send, D2), outcome logging (D7), and
list filters. It is the first concrete answer to NC1; the affordances are now reviewable rather
than hypothetical.

Established the **wireframe convention** (NC2 resolved), recorded in
[src/app/prototype/README.md](../../src/app/prototype/README.md):

- one evolving prototype app; screens are routes; slug = screen/flow identity;
- the README **registry is the join table** for the many-to-many screen <-> capability <-> component
  relationships;
- link only in stable directions: capability spec -> screen (`## Architecture`), architecture ->
  the registry (one supplementary pointer), registry -> everything;
- the whole-CRM prototype anchors to the **Primary journey** (a canonical named artifact), since it
  maps to no single capability - it is a clickable dynamic view of the journey, a peer to the
  sequence diagrams in `system-design.md`;
- gate isolation: coverage already excludes `src/app/**`; `**/prototype/**` ignored by jscpd.

Next: review the queue affordances, then mock prospect list / ICP config; distill locked decisions
into the `review-queue` capability spec (and an ADR only if a choice is architecturally load-bearing).

## Sources

- `docs/product-overview.md` (anchor views, D2/D7, open questions), `docs/architecture/system-design.md` (L3 components).
- `openspec/config.yaml` (the `## Architecture` spec-linking rule), `tests/canon-integrity.test.ts` (canon link/section checks).
- `package.json`, `src/app/globals.css` (installed Next 16 / Tailwind 4 facts).
- This build session (the clickable prototype and its verify-gate run).
