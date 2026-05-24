## Why

The C4 L1 system context (docs/architecture/system-context.md) deliberately deferred the container view: "The L2 container view (web app, in-process worker, datastore, sidecars) and detailed runtime sequences are not yet drawn - a later L2 change." Until those internal runnable units and the protocols between them are agreed, every area change (signals, qualification, outreach) re-litigates where its code runs - in a request handler, an in-process pg-boss job, or a sidecar - and how it reaches Postgres and the externals. This change draws that L2 container decomposition.

## Scope

**In:**
- The C4 level 2 container view: the internal runnable units inside the Wisery CRM boundary - the Next.js web app (React 19 Server Components + route handlers), the in-process pg-boss worker(s), the Postgres datastore, and any sidecar (e.g. self-hosted scraping/browser) - and the protocols and data that flow between them.
- Container-level runtime flows: the daily loop redrawn at container granularity (source scan -> normalize/persist -> qualify -> enrich -> draft -> queue), showing which container performs each step and where the job boundaries fall (honoring ADR-0001).
- How the L1 external edges (signal sources, scraping/enrichment provider, LLM API) attach to specific containers rather than to the box as a whole.

**Out:**
- Entity and data shapes (ERD, lifecycle, events) - domain-model, a later per-area change.
- Use-case re-derivation - the L1 actors already trace in the archived L1 change; no new system boundary is introduced.
- Deployment topology (which host, region, process supervisor) - a separate deployment slice.
- C4 level 3 component breakdown inside any single container - finer, later.
- Area-level internal design (the qualification LLM call structure, connector internals) - later area changes.

## Views

- `use-cases`: Skip - no new actors or system-boundary goals; this slice decomposes the inside of the box the L1 use-cases already framed. Leans on the archived L1 use-cases.
- `domain-model`: Skip - L2 containers decide runnable units and protocols, not entity shapes. The ERD, lifecycle, and events belong to later per-area domain-model changes.
- `system-design`: Required - the L2 container diagram and container-level runtime flows ARE this change. This is the section the L1 system-design explicitly parked ("Containers (C4 L2): Out of scope ... a later L2 change").
- `deployment`: Skip - where containers run (host, process supervisor, region) is a separate slice; this change fixes only WHAT the containers are and how they talk, all honoring ADR-0001's in-process stance.

## Quality attributes

- **Failure isolation / durability**: a single source scan or external call that fails must not take down the web app or other sources. The container split must put durable, retryable work (scans, enrich, qualify/draft) behind the pg-boss job boundary with a dead-letter path (ADR-0001). Scenario: a provider 500 on one source scan retries and dead-letters without affecting request latency or other scans.
- **Request-path latency vs background work**: interactive surfaces (ICP/profile config, lead list, approve queue) must stay responsive while CPU/IO-heavy steps run. The L2 split must keep long-running work off the request path (in-process worker now, `worker_threads` for CPU-bound steps, a no-rewrite path to a standalone worker - ADR-0001).
- **Secrets / trust containment**: provider and LLM API keys plus the Postgres connection string live only in server-side containers (the web app server and the worker), never in any client bundle (server-only). The container diagram must make the client/server cut explicit so no secret-bearing path crosses to the browser.

## Impact on canon

- Overview sections (docs/product-overview.md): cross-link the new container view from section 4 (the pipeline); no locked-decision change expected (ADR-0001 already governs the runtime). Note in section 9 that the L2 container question is now addressed.
- System-wide views: docs/architecture/system-design.md (NEW - the C4 L2 container diagram plus container-level runtime flows; flat at the top of the architecture folder per README rule 5, since there is still a single implicit area). Minor revision to docs/architecture/system-context.md to flip its "L2 not yet drawn" scope note into a link to the new system-design.md. docs/architecture/cross-cutting.md may gain L2-level mechanism detail only if the design surfaces it, otherwise unchanged.
- Area views (docs/architecture/areas/<area>/): none yet - single implicit area, so the L2 view stays flat (README rule 5). The first area split happens when a second area clearly emerges.
- ADRs: likely none new - ADR-0001 already fixes the in-process job runtime the container split honors. Revisit at the adr step; record one only if a durable new L2 boundary decision emerges (e.g. formalizing the web-app/worker process split or a sidecar boundary).
