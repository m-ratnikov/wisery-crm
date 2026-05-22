No ADR-worthy decision arose in this change.

The L1 system context documents the system boundary using decisions that already exist: D2 (human-only action) and D4 (a single, pluggable SignalSource / EnrichmentProvider interface) in docs/product-overview.md, plus ADR-0001 (background-job runtime). No new long-term commitment was introduced here, so there is nothing to promote.

The one open architectural question - whether qualification and first-touch drafting are one LLM call (D5) or a separate configurable step (UC3) - is internal-flow (C4 L2 / the qualification area) and is deferred to a later change, which may record an ADR (and supersede D5) then.
