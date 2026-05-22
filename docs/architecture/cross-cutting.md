# Cross-cutting concerns

System-wide concerns at the L1 boundary - where each lives and which decision fixes it.
Technology mechanisms (the logging library, the job queue, connection pooling) are L2
choices; this file names the concern and points to the deciding ADR.

Related: [system-context.md](system-context.md), [product-overview.md](../product-overview.md),
[ADR-0001](../adr/0001-background-job-runtime.md). Promoted from change `system-context-c4-l1` (2026-05-22).

- **Observability**: structured logging with dead-letter visibility from logs and SQL views over the job tables - no job dashboard UI (the logging library and queue are L2 technology choices; ADR-0001).
- **Configuration**: per-user ICP/profile/sources are config-as-data (D6); runtime config and provider endpoints via environment.
- **Secrets**: API keys for the scraping/enrichment provider and the LLM API, plus the Postgres connection string, live server-side only and never reach the client bundle (server-only). Connection and pooling specifics are an L2 concern (ADR-0001).
- **Failure handling**: external calls (the scraping/enrichment provider, the LLM API) run as durable background jobs with retries and a dead-letter path (ADR-0001 fixes the mechanism); a single source scan that fails is isolated and does not affect other sources.
- **Trust boundaries**: every external call is server-side; inbound third-party data (sources, enrichment) is untrusted and normalized at the edge (D4). Auth/sessions are deferred while single-user (D1); the CRM user is the only trusted principal today.
- **Data sensitivity**: third-party prospect PII enters from signal sources and any scraping/enrichment provider, is stored in Postgres, and is sent to the LLM API for scoring/drafting - the main data-processor exposure (product-overview open question). The only outbound path to the Prospect is the manual human action.
- **Scaling / capacity**: background work runs in-process now, with a no-rewrite path to a standalone worker if request latency degrades (ADR-0001). The binding constraints are the paid, rate-limited externals (the scraping/enrichment provider when used, the LLM API) - cost per call and throttling, which the design gates and tolerates rather than scales past.
