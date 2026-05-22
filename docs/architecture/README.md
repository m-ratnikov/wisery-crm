# Architecture (living canon)

The current, always-up-to-date picture of how wisery-crm is built. This is one of two
permanent stores; the other is the change archive (`openspec/changes/archive/`), which
keeps the history (proposals, stories, tasks) of how we got here. Read this folder to
answer "how is the system built today?"; read the archive to answer "why?".

These docs are the promoted, ratified output of `spec-driven-architecture` changes. Each
change drafts views under `openspec/changes/<change>/`; at `apply` the drafts are re-sliced
BY SCOPE into the homes below (not copied file-to-file), and ADR drafts move to `docs/adr/`.

## Layout

- `../product-overview.md` - the spine: north-star, locked-decisions table (-> ADRs),
  pipeline, MVP scope, open questions, durable personas/journey. System-wide views may live
  here as sections until they grow into their own file.
- `glossary.md` - the ubiquitous language. ONE per bounded context (we have one - the CRM
  core), so one glossary today.
- `system-context.md` - C4 level 1 (the system + external actors). System-wide, one file.
- `cross-cutting.md` - observability, secrets, trust boundaries, data sensitivity, scaling.
  System-wide, one file.
- `deployment.md` - deployment topology. System-wide, present only when where-things-run is
  decided.
- `context-map.md` - how bounded contexts relate. Appears ONLY if a second bounded context
  emerges (e.g. billing); not needed now.
- `areas/<area>/` - one folder per area/subdomain within the context (e.g. signals,
  qualification, outreach), each holding exactly:
  - `domain-model.md` - this area's ERD, lifecycle, and domain events.
  - `system-design.md` - this area's C4 level 2 containers and runtime flows.

## Rules

1. Three levels: a bounded CONTEXT (one model + one language; we have one - the CRM core)
   contains AREAS/subdomains (the `areas/` folders), which contain CAPABILITIES (OpenSpec
   specs in `openspec/specs/`, finer). The folder axis is the AREA: a capability is too fine
   (it would fragment shared models), a context too coarse (one folder).
2. Fixed filenames inside an area folder: only `domain-model.md` and `system-design.md`
   (+ `deployment.md` only if that area runs somewhere special). No free-naming.
3. System-wide content has exactly ONE copy (glossary, system-context, cross-cutting,
   deployment). Never duplicate it per area.
4. A change UPDATES the homes it touches; it never dumps new ad-hoc files. Two changes
   refining the same area both edit that area's `domain-model.md`.
5. Start flat: while there is one implicit area, keep `domain-model.md` / `system-design.md`
   at the top of this folder. Split into `areas/<name>/` when the single model grows or a
   second area clearly emerges. Add per-context glossaries + `context-map.md` only if a
   genuinely separate bounded context appears.

## How specs reference this canon

A capability (`openspec/specs/<capability>/spec.md`) MAY link UP to its architectural home via
an optional `## Architecture` section: the relevant docs here (or the `../product-overview.md`
spine) plus the governing ADRs. The link is ONE-WAY (spec -> architecture); we do not maintain a
reverse list of capabilities inside the view docs (that is the sync trap - see the tooling
decision). The reference lives on the canonical spec, not the change delta, since the delta
parser only carries `## ADDED/MODIFIED/...Requirements` through archive.

The section is optional because the architecture schema is opt-in - a capability with no
architecture to point at simply omits it. When a spec DOES have an `## Architecture` section,
`tests/arch-links.test.ts` (run via `npm test`) fails if any link in it does not resolve to a
real file. It checks that pointers exist, never that the linked content agrees - keeping spec
and architecture in agreement stays a human review judgment.

ADRs live in `../adr/`, numbered and immutable once accepted; the view docs here are living
and revised by later changes. The reasoning behind this layout is in
`../explore/2026-05-21-architecture-folder-organization.md`.
