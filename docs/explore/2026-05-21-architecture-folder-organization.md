# Explore: Architecture folder organization convention

- Date: 2026-05-21
- Decision: proposed - applied to the spec-driven-architecture schema + this folder's README on 2026-05-21
- Method: design proposal, refined through review

## Question

OpenSpec specs are organized by capability folders (`openspec/specs/<capability>/spec.md`).
The `spec-driven-architecture` schema promoted view docs into `docs/architecture/` with
no equivalent rule, so the folder risked becoming a flat junk drawer (which filenames are
canonical? what happens when a second change also has a `domain-model.md`?). How should
`docs/architecture/` be organized so it stays navigable as the system grows?

## Assumptions and constraints

- Solo developer, pre-MVP. The rule must scale but cost nothing now.
- ADRs at `docs/adr/NNNN-*.md` are already well-organized (numbered, one decision each,
  immutable) - the model of good organization already in the repo.
- `docs/product-overview.md` is the spine (north-star) and stays where it is.
- No em-dashes in repo content (use short hyphens with spaces).

## Clarifications (resolved during review)

- **Granularity: per area, not per capability and not per bounded context.** A capability
  is too fine - several capabilities share the same entities and containers, so a folder
  per capability would duplicate the model and let it drift. A bounded context is too
  coarse - we have only one (the CRM core), which would mean one folder. The right axis is
  the AREA / subdomain in between.
- **"signals" and "qualification" are areas, not bounded contexts.** Earlier drafts called
  them "contexts", which contradicted "you have one context". They are subdomains inside
  the single CRM-core bounded context.
- **Is `domain-model.md` + `system-design.md` enough per area? Yes** - but we missed two
  system-wide things: a `context-map.md` (how bounded contexts relate; only when there is
  more than one) and the glossary's placement (it tracks the bounded context, so one
  glossary today).
- **"Transient" did not mean deleted.** The change folder is MOVED to
  `openspec/changes/archive/` at archive time. Artifacts without a living-canon home
  (proposal, stories, tasks) are preserved there as history, not thrown away.

## Unknowns (now resolved)

- NC1 system-wide vs per-area views - resolved by the hybrid layout below.
- NC2 filename sprawl - resolved by a fixed filename vocabulary.
- NC3 two changes touching the same view - they edit the same canonical file (merge).
- NC4 mapping to spec capabilities - capabilities map INTO an area (many to one).

## Options considered

- **Flat fixed set** - one `domain-model.md` + `system-design.md`, each change merges.
  Simple, but single files balloon as areas multiply.
- **Folder per area (chosen, hybrid)** - system-wide views are single flat files;
  per-area deep views live under `areas/<area>/`. Scales, mirrors specs' folder-per-
  capability for the deep views, and respects that some views are global.

## Key findings

### Two permanent stores, not one

- **Living canon** = the current state. `docs/product-overview.md` (the overview /
  "spine") + `docs/architecture/` + `docs/adr/`. Read it to answer "how is the system
  built today?"
- **Archive** = the history. `openspec/changes/archive/<date>-<name>/`, the frozen change
  folder with its proposal, stories, and tasks. Read it to answer "why did we shape it
  that way?" Nothing is deleted; it just is not living canon.

### Promotion is a re-slice by scope, not a file copy

The schema organizes DRAFTS by view type (how you think during a change). The canon is
organized by SCOPE (how you navigate the system). At `apply`, each draft view's sections
are distributed to the home that matches their scope, keeping one copy of system-wide
content. Mapping:

| Draft artifact | Section | Lands in |
|---|---|---|
| proposal | Why / Scope / Views / Impact | archive (history) |
| proposal | Quality attributes | overview section (or its own file when it grows) |
| stories | Personas | overview "Personas" (durable bits only) |
| stories | Primary journey | overview, or already captured as a system-design runtime flow |
| stories | User stories / Acceptance signals | archive; durable behavior becomes an OpenSpec spec |
| domain-model | Glossary | shared `glossary.md` (one per bounded context) |
| domain-model | ERD / Lifecycle / Domain events | `areas/<area>/domain-model.md` |
| system-design | C4 L1 system context | `system-context.md` (or overview) |
| system-design | C4 L2 containers / Runtime flows | `areas/<area>/system-design.md` |
| system-design | Decisions and trade-offs | `docs/adr/NNNN-*.md` |
| system-design | Cross-cutting | `cross-cutting.md` (or overview) |
| deployment | all | `deployment.md` |
| adr | all | `docs/adr/` |
| tasks | all | archive (it is the promotion checklist) |

### Worked example (the signals-connector change)

One change folder split into four homes: the words Source/Signal/RawItem -> the shared
glossary; the entity diagram -> `areas/signals/domain-model.md`; the whole-system C4
diagram -> the overview; the zoom-in diagram -> `areas/signals/system-design.md`; the
connector-contract decision -> a numbered ADR. The proposal and tasks stayed behind in
the archived change folder.

## Outcome - the convention (applied)

### Layout

```
docs/
  product-overview.md           # the overview/spine: north-star, locked decisions (-> ADRs),
                                #   pipeline, MVP scope, open questions, durable personas/journey;
                                #   system-wide views may sit here as sections until they grow
  adr/  NNNN-*.md               # decisions, numbered, immutable
  architecture/
    README.md                   # the map + these rules
    glossary.md                 # ubiquitous language; ONE per bounded context (we have one)
    system-context.md           # C4 L1; system-wide, one file
    cross-cutting.md            # observability/secrets/trust/data-sensitivity/scaling; one file
    deployment.md               # topology; present only when where-things-run is decided
    context-map.md              # how contexts relate; ONLY when a second context appears
    areas/
      signals/
        domain-model.md          # this area's ERD + lifecycle + domain events
        system-design.md         # this area's C4 L2 + runtime flows
      qualification/
        ...
```

### Rules

1. Three levels: a bounded CONTEXT (one model + one language; we have one - the CRM core)
   contains AREAS/subdomains (the `areas/` folders) which contain CAPABILITIES (OpenSpec
   specs, finer). The folder axis is the AREA.
2. Fixed filenames inside an area: only `domain-model.md` and `system-design.md`
   (+ `deployment.md` only if that area runs somewhere special). No free-naming.
3. System-wide content has exactly ONE copy (glossary, system-context, cross-cutting,
   deployment). Never duplicate per area.
4. A change UPDATES the homes it touches; it never dumps new ad-hoc files.
5. Start flat: while there is one implicit area, keep `domain-model.md` / `system-design.md`
   at the top of `architecture/`. Split into `areas/<name>/` when the single model grows or
   a second area emerges. Add per-context glossaries + `context-map.md` only if a genuinely
   separate bounded context appears.

### Applied on 2026-05-21

- `docs/architecture/README.md` - rewritten to carry these rules.
- Schema `proposal` "Impact on canon" - now names targets by scope (overview sections /
  system-wide views / area views / ADRs).
- Schema `tasks` and `apply` - promotion changed from flat "copy file -> file" to
  "distribute by scope".

## Sources

- Project conventions: `openspec/specs/<capability>/`, `docs/adr/` numbering.
- Prior panel research this session: C4 model (Structurizr/LikeC4/IcePanel), DDD bounded
  contexts (Fowler), and the different-lenses guidance behind splitting system-wide from
  per-area content. A separate review this session concluded we should not build bespoke
  architecture tooling (link, do not sync); compose LikeC4 + a thin link layer only on triggers.
