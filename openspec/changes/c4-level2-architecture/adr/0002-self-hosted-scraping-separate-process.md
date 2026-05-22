# ADR-0002: Self-hosted scraping runs as an optional separate process

- Status: proposed
- Date: 2026-05-22
- Supersedes: none
- Source: openspec/changes/c4-level2-architecture/system-design.md (Decisions - "Self-hosted scraper as a separate optional process") and the C4 L2 architecture review panel.

## Context

D4 puts scraping and enrichment behind the `SignalSource` / `EnrichmentProvider` interfaces and allows self-hosting (a headless browser) as an alternative to a managed provider such as Apify. ADR-0001 makes in-process the default for background work and names HTML parsing as the example of CPU-bound work that goes on a `worker_threads` pool inside the process.

A full headless browser is far heavier than parsing: high memory, its own lifecycle, and a wide crash blast radius. Authenticated scraping of hardened targets (LinkedIn, X) also carries detection and ban risk that must stay off the user's own account (D2). ADR-0001 did not settle whether the browser runs in-process or as its own unit, and the L2 container view needs that boundary fixed.

## Decision

We will run self-hosted scraping as an **optional, separately deployable process** (its own container/unit), not inside the web/worker process. The worker drives it over **HTTP on a private/localhost endpoint from within a pg-boss job**, so a scraper crash is an isolated, retried, dead-letterable job failure rather than a shared-memory fault.

The **managed provider (e.g. Apify) is the default** path for hardened/authenticated targets; self-host is the escape hatch behind the same D4 ports, and the two are interchangeable adapters. When self-hosting, we will use **Playwright** over Puppeteer (per-context isolation, proxy-per-context, a maintained anti-detection ecosystem). The process is absent entirely when only public APIs or a provider are used.

## Consequences

- One extra optional deployable unit and an HTTP control hop - accepted, because browser automation is the heaviest and riskiest dependency; isolating it protects the worker event loop and lets the browser restart independently.
- This **extends** ADR-0001's in-process default for one specific heavy dependency; it is not a reversal - everything else stays in-process.
- Any session cookies or credentials for self-host scraping live only in this second server-side unit (`server-only`); that secret/trust surface is contained there and widens the deployment slice (deferred to a deployment change).
- Defaulting to the provider for hardened targets keeps detection/ban risk off the user's own account (D2); self-host is explicitly not the primary path for those targets given current anti-bot reality.
