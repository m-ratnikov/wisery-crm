## Why

The architecture-overview names "signal scans" as the pipeline's entry point but
does not say how a new external source (a scraper, an RSS feed, a third-party API)
plugs in. Today every source would be hand-wired into the pipeline; this change
defines the connector boundary so sources are config-as-data, not code forks.

## Scope

**In:** The contract between an external signal source and the pipeline - how a
source is registered, how raw items cross the boundary, and how they become Signals.

**Out:** The qualification/enrichment stages downstream of a Signal; the specific
vendor for any one source; rate-limit policy (already an open question elsewhere).

## Views

- `stories`: Required - the consultant configures sources, so there is a job here.
- `domain-model`: Required - introduces Source and Signal and their fan-out.
- `system-design`: Required - this is fundamentally a boundary/contract change.
- `deployment`: Skip - sources run inside the existing in-process worker (ADR-0001); where-things-run does not change.

## Quality attributes

- **Isolation**: one failing source must not stall scans for other sources.
- **Idempotency**: re-scanning a source must not create duplicate Signals.
- **Extensibility**: adding a source type is config + a connector module, no pipeline rewrite.

## Impact on canon

- `docs/architecture-overview.md`: add Source to the pipeline diagram and the glossary; add an open-question resolution note.
- `docs/architecture/domain-model.md`: new (Source, Signal, fan-out).
- `docs/architecture/system-design.md`: new (connector boundary + scan runtime flow).
- Expected ADR: the connector contract (a normalized RawItem in, the source owns auth/paging).
