# System design (C4 L2) - containers and runtime flows

The container view of Wisery CRM: the separately runnable and deployable units inside (and at the
edge of) the boundary, the protocols between them, and the two highest-judgment runtime flows. The
L1 system context is in [system-context.md](system-context.md); cross-cutting concerns in
[cross-cutting.md](cross-cutting.md); the decisions behind this view are
[ADR-0001](../adr/0001-background-job-runtime.md), [ADR-0002](../adr/0002-headless-browser-scraping.md),
[ADR-0003](../adr/0003-llm-provider-port.md), and [ADR-0004](../adr/0004-pg-boss-facade.md).

Promoted from change `c4-level2-architecture` (2026-05-24); flat at the top of the architecture folder
while there is a single implicit area (README rule 5).

## Containers

The separately runnable and deployable units inside (and at the edge of) the Wisery CRM boundary, and
the protocols between them. The test for a container here is "something that has to be running for the
system to work" - a process or a datastore - not a code grouping inside one of them (that is L3).

Per ADR-0001, the web app and the pg-boss worker are two ROLES of a single Node process, so they are
ONE container, annotated with both responsibilities - not two boxes. Their split into web/worker
roles, the optional `worker_threads` pool, and the on-demand headless browser Playwright launches for
browser-needing scrapes are L3 internals, deliberately not drawn. Internal containers (what we build
and run) are blue; external systems we depend on but do not control are grey; the one optional
external unit and its edge (the provider) are dashed. A legend follows the diagram.

```mermaid
flowchart TB
    browser["Browser - thin client<br/>[Container: client-side, minimal JS over RSC]"]

    app["Wisery CRM app<br/>[Container: Next.js 16 / Node 22, next start + systemd]<br/>serves anchor-view UIs (RSC + route handlers)<br/>AND hosts the in-process pg-boss worker<br/>(scan, normalize, qualify, enrich, draft)<br/>headless scrape: in-process Playwright launches a browser OS process on demand (L3)"]

    db[("Managed Postgres<br/>[Container: datastore]<br/>app data + pg-boss job tables")]
    src["Signal sources<br/>LinkedIn search, X, CSV, news, job boards"]
    dp["Scraping / enrichment provider<br/>e.g. Apify - optional, pluggable (D4)"]
    llm["LLM provider<br/>[External System]<br/>e.g. Anthropic (default), OpenAI"]

    browser -->|"HTTPS / RSC"| app
    app -->|"app queries (Postgres wire, pooled endpoint - Drizzle)"| db
    app -->|"jobs (Postgres wire, direct pg-boss pool)"| db
    app -->|"pull sources (HTTPS)"| src
    app -.->|"pull / expand / deep-enrich (HTTPS) - provider path"| dp
    app -->|"qualify + draft (HTTPS, carries PII)"| llm

    classDef internal fill:#cfe3ff,stroke:#4a78b5,color:#10243e;
    classDef external fill:#ececec,stroke:#9a9a9a,color:#1f1f1f;
    classDef optional stroke-dasharray: 5 5;
    class browser,app,db internal;
    class src,dp,llm external;
    class dp optional;
```

**Legend.**

```mermaid
flowchart LR
    Li["Internal container<br/>(part of our system)"]
    Lx["External system<br/>(we integrate, do not own)"]
    Ld[("Our datastore")]
    Lxo["External + optional<br/>(e.g. provider)"]
    Ra[" "] -->|"required"| Rb[" "]
    Oa[" "] -.->|"optional / conditional"| Ob[" "]

    classDef internal fill:#cfe3ff,stroke:#4a78b5,color:#10243e;
    classDef external fill:#ececec,stroke:#9a9a9a,color:#1f1f1f;
    classDef optional stroke-dasharray: 5 5;
    class Li,Ld internal;
    class Lx,Lxo external;
    class Lxo optional;
```

Key: a **solid** arrow is an always-present relationship; a **dashed** arrow is an optional/conditional
path (present only on the D4 self-host or provider path), not an async marker. Arrows are
unidirectional and point from caller to dependency - the response is implied, which is why this view
has no double-headed arrows. **Rectangle** = process/container, **cylinder** = datastore. **Blue** =
internal (part of the system we are building, including our own datastore even when managed-hosted),
**grey** = external system we integrate with but do not own. The two axes are independent: the
provider, for instance, is external-and-optional.

The three outbound source paths - a direct API/HTTP pull (in-process), a spawned headless-browser
child (for self-host targets that need a real browser), and the provider - are per-source
ALTERNATIVES selected by the D4 cost/ban-risk knob, not concurrent. The app's outbound edges to
sources and the provider are not direct vendor bindings: they cross the D4 `SignalSource` /
`EnrichmentProvider` ports. Apify and the self-host browser path are interchangeable adapters behind
those ports, which is why a new source is a new adapter, not a pipeline change (D4, D8).
LLM-agnosticism is a locked product decision (D9): the LLM provider sits behind an `LLMProvider`
port - a peer of the D4 `SignalSource` / `EnrichmentProvider` ports, all of them seams across the
system boundary - where every data-returning call is a provider-neutral JSON Schema validated with
Zod, the wire schema kept within that provider's supported structured-output subset and richer
constraints enforced in a post-parse Zod refine, so Anthropic is the default adapter rather than a
binding (D9, ADR-0003). (The in-process queue, by contrast, is reached via a thin pg-boss facade that
is deliberately not a portability seam - see the Managed Postgres entry.) An authenticated source
never uses the direct pull (the ToS/ban-risk path the product avoids, D2); it goes via the spawned
browser child or the provider, with the provider the default for hardened targets (ADR-0002).

Container by container, and why each qualifies as a container (not a component):
- **Wisery CRM app**: one Node process (`next start` + systemd). It is a single container because both roles run in the same process and share one event loop (ADR-0001); the web/worker split, the optional `worker_threads` pool, and the on-demand headless-browser process the worker launches for browser-needing scrapes are L3 components. **Peel-safety invariant**: the no-rewrite peel into a standalone `worker.ts` holds only while the web and worker roles share state solely through Postgres - no module-level mutable singletons, no in-process caches or event buses, no transaction or connection spanning a request handler and a job (ADR-0001). The peel is the moment this becomes two containers (the worker onto its own process, and later its own host). The headless browser is launched in-process via Playwright only for self-host targets that need a real browser; `launch()` spawns and supervises it as a separate OS process over a pipe/CDP (heavy: memory, own lifecycle, wide crash blast radius), so its weight stays off the worker's event loop and `close()` reaps it per scrape. Concurrent browsers are capped by a semaphore sized to host memory (the same budget discipline as the pg-boss pool), with try/finally `close()` + a hard timeout + an orphan reaper to bound the OOM-on-leak risk on the shared host; a `newContext()` warm-browser reuse, then a `launchServer()` pool or a dedicated host, are later scaling levers, not the default (ADR-0002).
- **Browser - thin client**: the client-side container; thin because most rendering is server-side (RSC). Drawn so the client/server cut is explicit - no secret-bearing path crosses to it.
- **Managed Postgres**: the datastore container; one instance holds both app data and the pg-boss job tables (ADR-0001), so it is a single failure domain for serving and background work - a Postgres outage halts both, accepted while single-user. It is drawn inside the system boundary (internal) because it is the system's own datastore - we own its schema - not a third-party system we integrate with; managed hosting (Neon/Supabase/RDS, ADR-0001) is an operational fact, not a boundary change, unlike the genuinely external LLM, provider, and sources. The two access modes (pooled endpoint for app queries, a direct connection for pg-boss) are a property of how the app connects: pg-boss claims work by long-polling with `SKIP LOCKED` and runs its own long-lived `pg.Pool`, so it is given a direct connection rather than fronted by a transaction-mode pooler, which would be redundant in front of its pool (its advisory locks are transaction-scoped and pooler-safe, so they are not the reason) - ADR-0001. pg-boss's persistent connections are sized via its pool `max` and budgeted against the database's connection cap alongside the pooled app connections. The app reaches pg-boss through a thin pg-boss facade (a wrapper for testability and to localize the pg-boss API), deliberately not a portability seam: pg-boss's transactional enqueue - a job created atomically with its originating data write - is a Postgres-backed-queue property the facade does not abstract away, so the queue stays intentionally Postgres-coupled and a real backend change would be a future superseding decision, not a free adapter swap (ADR-0004).

## Key runtime flows

Two highest-judgment flows, both consistent with the L1 boundary flow and the primary journey. These
are dynamic views over the containers above; because the web and worker are one container, the app
appears once and a note marks when it is acting in its in-process worker capacity (ADR-0001).

### Intelligence pipeline - scheduled scan to queued draft

```mermaid
sequenceDiagram
    participant App as Wisery CRM app
    participant DB as Postgres
    participant SRC as Signal source
    participant SC as Headless browser (Playwright, separate OS process)
    participant DP as Provider / Apify (optional)
    participant LLM as LLM provider

    Note over App: pg-boss cron fires one scan job per configured Source (D8) - in the in-process worker
    App->>SRC: pull public/unauth (HTTPS)
    SRC-->>App: raw records
    opt self-host browser path (D4) - worker drives Playwright in-process
        App->>SC: launch() + drive (CDP over pipe)
        SC->>SRC: fetch (HTTPS)
        SRC-->>SC: raw records
        SC-->>App: raw records - close() reaps the process
    end
    opt provider path (D4, default for hardened targets)
        App->>DP: pull / expand company -> people (HTTPS)
        DP-->>App: people records - provider shape, raw (HTTPS)
    end
    Note over App,DP: company/content sources expand (above) before qualify - that spend is pre-gate,<br/>mitigated by a cheap firmographic pre-check + title-filtered expansion (product-overview)
    Note over App: normalize raw records -> RawItems at the edge (our D4 connector),<br/>then dedup -> Signals (drop already-seen)
    App->>DB: persist Signals + enqueue qualify jobs
    Note over App,DB: one scan job per Source - a failure is isolated,<br/>retried, and dead-lettered by pg-boss (ADR-0001)
    App->>LLM: qualify - ICP score on the signal (HTTPS, carries PII)
    LLM-->>App: score (1-5)
    Note over App,DB: qualify and the draft-after-enrich run as separate pg-boss jobs -<br/>each externally-billed step idempotent, own prompt_version, a draft retry never re-bills qualify (ADR-0001)
    alt score >= 3
        opt deep-enrich (provider available, D4)
            App->>DP: deep-enrich prospect (HTTPS)
            DP-->>App: enrichment (HTTPS)
        end
        App->>LLM: draft first touch from the dossier (HTTPS, carries PII)
        LLM-->>App: draft
        App->>DB: persist qualified prospect + dossier + draft (queued)
    else score < 3
        App->>DB: persist below-bar (silent)
    end
```

### Human review and act

```mermaid
sequenceDiagram
    actor U as CRM user
    participant B as Browser (thin client)
    participant App as Wisery CRM app
    participant DB as Postgres
    actor P as Prospect

    U->>B: open approve queue
    B->>App: request (HTTPS / RSC)
    App->>DB: read queued prospects + dossier + draft (pooled endpoint)
    DB-->>App: rows
    App-->>B: rendered queue - no secrets cross to the client
    U->>P: act manually via chosen channel (outside the system, ToS-safe D2)
    U->>B: log outcome
    B->>App: outcome
    App->>DB: persist outcome against score (D7)
```
