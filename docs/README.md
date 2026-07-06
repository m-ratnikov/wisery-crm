# docs/ - the map

Three zones, split by subject and lifecycle. Provenance:
[explore/2026-07-02-review-loop-determinism.md](explore/2026-07-02-review-loop-determinism.md)
(the session that also drew this boundary).

## process/ - how we build (living, project-agnostic)

The engineering harness: [engineering.md](process/engineering.md) (gates, review loops,
definition of done), [system-review.md](process/system-review.md),
[verification-gate.md](process/verification-gate.md),
[review-panel.md](process/review-panel.md),
[module-conventions.md](process/module-conventions.md). Maintained in place; edited
directly (framework changes skip OPSX).

**Extraction set.** `process/` + `.claude/` (agents, commands, hooks) + the generic doc
tests (`tests/mermaid.test.ts`, `tests/arch-links.test.ts`) + `scripts/review-loop.mjs`
are the reusable framework. When a second greenfield project adopts it: `.claude/` and
the scripts become a Claude Code plugin, the tests and base configs an npm package, and
`process/` docs a copy-then-own template. Do not extract before a second consumer
exists (rule of three).

## Product canon - what we build (living; decisions immutable)

[product-overview.md](product-overview.md) (north star),
[roadmap.md](roadmap.md) (build order), [architecture/](architecture/README.md)
(C4 views, domain model, glossary - organized per its README),
[adr/](adr/) (numbered decisions, immutable, superseded never edited).

## Journal - what happened (dated, write-once)

[explore/](explore/README.md) - the research behind decisions (product and process
both; the inbound link supplies the context). [reviews/](reviews/) - system-review
records. Snapshots: linked, never rewritten.
