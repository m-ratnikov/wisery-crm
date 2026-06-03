# Cross-cutting concerns

System-wide concerns at the L1 boundary - where each lives and which decision fixes it.
Technology mechanisms (the logging library, the job queue, connection pooling) are L2
choices; this file names the concern and points to the deciding ADR.

Related: [system-context.md](system-context.md), [system-design.md](system-design.md),
[product-overview.md](../product-overview.md), [ADR-0001](../adr/0001-background-job-runtime.md),
[ADR-0002](../adr/0002-headless-browser-scraping.md), [ADR-0003](../adr/0003-llm-provider-port.md),
[ADR-0004](../adr/0004-pg-boss-facade.md). Promoted from change `system-context-c4-l1` (2026-05-22);
L2 references added by `c4-level2-architecture` (2026-05-24).

- **Observability**: structured logging with dead-letter visibility from logs and SQL views over the job tables - no job dashboard UI (the logging library and queue are L2 technology choices; ADR-0001).
- **Configuration**: per-user ICP/profile/sources are config-as-data (D6); runtime config and provider endpoints via environment.
- **Secrets**: API keys for the scraping/enrichment provider and the LLM provider (provider-agnostic behind the `LLMProvider` port, D9), plus the Postgres connection strings, live server-side only and never reach the client bundle (server-only). On the self-host browser path, scraping session material lives in the browser's OS process (ADR-0002). Connection and pooling specifics are an L2 concern (ADR-0001).
- **Failure handling**: external calls (the scraping/enrichment provider, the LLM provider) run as durable background jobs with retries and a dead-letter path (ADR-0001 fixes the mechanism); a single source scan that fails is isolated and does not affect other sources; a self-host headless-browser crash is contained in its own OS process (ADR-0002). Stage-to-stage handoffs are atomic: a stage enqueues the next stage's job inside the same Drizzle transaction as its state write (pg-boss's `fromDrizzle` adapter), so a committed transition can never be stranded without its follow-on job ([ADR-0009](../adr/0009-atomic-enqueue-handoff.md)). This requires pg-boss to share the app's Postgres database (the default); a separate pg-boss database forfeits the atomicity and is unsupported for the atomic handoff.
- **Trust boundaries**: every external call is server-side; inbound third-party data (sources, enrichment) is untrusted and normalized at the edge (D4). Auth/sessions are deferred while single-user (D1); the CRM user is the only trusted principal today.
- **Data sensitivity**: third-party prospect PII enters from signal sources and any scraping/enrichment provider, is stored in Postgres, and is sent to the LLM provider for scoring/drafting - the main data-processor exposure; the PII surface spans whichever provider is selected (D9), and field minimization attaches at the qualify boundary when productized (D10). Within the data model the PII concentrates in the runtime entities - the Signal payload, the Scoring reason/summary, the Dossier, and the Draft - which keeps minimization a single seam at the qualify boundary rather than scattered. The only outbound path to the Prospect is the manual human action.
- **Scaling / capacity**: background work runs in-process now, with a no-rewrite path to a standalone worker if request latency degrades (ADR-0001). The binding constraints are the paid, rate-limited externals (the scraping/enrichment provider when used, the LLM provider) - cost per call and throttling, which the design gates and tolerates rather than scales past.
