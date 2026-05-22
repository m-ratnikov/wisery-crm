## Why

docs/product-overview.md describes the pipeline stage by stage but never draws the system as a single boundary - which external systems it depends on, which human actors touch it, and what crosses each edge. Without an agreed C4 level 1 picture, every later area change re-litigates the same boundary questions (what is ours versus a third party, where third-party prospect data enters and leaves our control).

## Scope

**In:**
- The C4 level 1 system context: Wisery CRM as one box, its human actor(s), and every external system it exchanges data with, with one line per boundary on what crosses it.
- The system-wide trust and data-sensitivity boundaries visible at L1 (where third-party prospect data enters from sources/enrichment and where the human action edge sits).

**Out:**
- C4 level 2 container view (internal runnable units) and detailed runtime sequence diagrams - a later change.
- Any entity or data-model shaping (no ERD) - belongs to later area changes.
- Deployment topology (where things run) - a separate change.
- Area-level design (signals, qualification, enrichment, outreach) - later area changes.

## Views

- `use-cases`: Required - the L1 actors (the CRM user; external sources, the data provider, and the prospect as actors) must trace to who the system serves. Kept light, leaning on the persona already in product-overview rather than re-deriving it.
- `domain-model`: Skip - no entity shapes are decided at L1; entities belong to later per-area changes.
- `system-design`: Required - the L1 system context diagram and its external dependencies are the entire point of this change. Scoped to the L1 context section; the L2 container view is explicitly out.
- `deployment`: Skip - where-things-run is a separate slice.

## Quality attributes

- **Privacy / data sensitivity**: third-party prospect data (PII) crosses the boundary inbound from signal sources and enrichment providers. The L1 picture must make every such edge explicit so the data-processor exposure (product-overview open question) is visible at a glance.
- **ToS-safe action boundary (D2)**: the action edge (LinkedIn) is human-operated. The L1 picture must show that no automated sending crosses that boundary - the system hands the human a drafted touch, it does not act.
- **External-dependency cost and availability**: paid and rate-limited third parties (Apify, the Anthropic LLM API) sit on the boundary. L1 should name them as the dependencies whose cost and degraded availability the design must tolerate.

## Impact on canon

- Overview sections (docs/product-overview.md): cross-link the new system-context view from section 4 (the pipeline); mark the high-level-boundary question as addressed in section 9.
- System-wide views: docs/architecture/system-context.md (new - the C4 L1 diagram plus a one-line note per external edge); docs/architecture/cross-cutting.md (the trust-boundary and data-sensitivity notes at the system edge, if system-design produces them).
- Area views (docs/architecture/areas/<area>/): none - this slice is system-wide.
- ADRs: likely none new - the single-interface external-integration boundary is already covered by D4 (product-overview). Revisit at the adr step and record one only if a durable L1 boundary decision emerges.
