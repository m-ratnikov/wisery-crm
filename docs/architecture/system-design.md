# System design (C4 L2 + L3) - containers, runtime flows, and components

The container view of Wisery CRM (C4 L2) plus the component decomposition inside the app container
(C4 L3): the separately runnable units, the protocols between them, the highest-judgment runtime
flows, and the components that make up the one app process. The L1 system context is in
[system-context.md](system-context.md); the data model in [domain-model.md](domain-model.md);
cross-cutting concerns in [cross-cutting.md](cross-cutting.md); the decisions behind this view are
[ADR-0001](../adr/0001-background-job-runtime.md), [ADR-0002](../adr/0002-headless-browser-scraping.md),
[ADR-0003](../adr/0003-llm-provider-port.md), [ADR-0004](../adr/0004-pg-boss-facade.md),
[ADR-0005](../adr/0005-signal-to-prospect-fan-out.md),
[ADR-0006](../adr/0006-pre-code-l3-component-view.md), and the engagement/triage slice
[ADR-0013](../adr/0013-universal-triage-intake.md)..[ADR-0018](../adr/0018-engagement-artifacts-post-comment.md).

Promoted from change `c4-level2-architecture` (2026-05-24); the C4 L3 component section added by
`c4-level3-and-domain-model` (2026-05-26); the universal-triage and engagement runtime flows and
components added by `content-marketing-engagement` (2026-06-07). Containers are unchanged - the new
work is components inside the existing app container, no new container or port. Flat at the top of the
architecture folder while there is a single implicit area (README rule 5).

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

Two highest-judgment flows, both consistent with the [L1 boundary flow](system-context.md#boundary-runtime-flow) and the [primary journey](../product-overview.md#primary-journey). These
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
    App->>LLM: qualify - score the signal-derived person, signal as cost gate (HTTPS, carries PII)
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

### Scan to triage decision (universal-triage intake)

The intake reframe ([ADR-0013](../adr/0013-universal-triage-intake.md)): every signal awaits a human
approve/dismiss before any entity is created. The advisory LLM score runs in its own bounded queue,
enqueued in the signal's persist transaction but executed outside it.

```mermaid
sequenceDiagram
    actor U as CRM user
    participant App as Wisery CRM app
    participant DB as Postgres
    participant SRC as Signal source
    participant LLM as LLM provider

    Note over App: pg-boss cron fires one scan job per Source - in the in-process worker
    App->>SRC: pull (HTTPS, via SignalSource port)
    SRC-->>App: raw records
    Note over App: normalize -> RawItems -> dedup -> persist immutable Signals
    App->>DB: persist Signals (insert on conflict do nothing)
    Note over App,DB: every signal awaits triage - no per-source bypass (ADR-0013)
    App->>DB: enqueue one advisory-filter job per new signal (in that signal's persist tx, ADR-0009)
    Note over App,LLM: advisory-filter is its own capped-concurrency queue - in the worker, outside any tx
    App->>LLM: advisory score by intent (rubric.kind matches signal kind/type)
    LLM-->>App: advisory result (1-5 / peer-fit / company-fit)
    App->>DB: attach advisory result to the triage read-model
    U->>App: open Queue (kind = triage), approve or dismiss
    alt approve
        Note over App,DB: one tx (ADR-0009)
        App->>DB: SignalDecision approved, route by kind (Person / Company / author-as-peer + Post), enqueue qualify for type = prospect
    else dismiss
        App->>DB: SignalDecision dismissed (a later re-scan cannot resurface it)
    end
```

### Monitor, fetch posts, draft a comment (engagement loop)

The engagement motion ([ADR-0018](../adr/0018-engagement-artifacts-post-comment.md)): post fetch and
comment generation are user-triggered and cost-bounded; the human posts every comment (D2).

```mermaid
sequenceDiagram
    actor U as CRM user
    participant App as Wisery CRM app
    participant DB as Postgres
    participant DP as Provider / Apify (optional)
    participant LLM as LLM provider
    actor T as Engagement target

    U->>App: flag a person monitored
    App->>DB: Person.monitored = true
    opt user-triggered on the person card (ADR-0007 pattern)
        U->>App: "get latest posts"
        App->>DP: fetch recent activity (HTTPS, via EnrichmentProvider.fetchPosts)
        DP-->>App: posts (provider shape)
        App->>DB: upsert Post by (person_id, dedup_key)
    end
    Note over App,DB: a scheduled activity-scan cron enqueues one fetch-posts job per monitored person - in the worker
    U->>App: open Feed -> a post detail (full post + person-360)
    App->>DB: read post + person + posts + comments + history (pooled endpoint)
    DB-->>App: rows
    U->>App: generate comment (synchronous server action)
    App->>LLM: comment from person info + global guidance (HTTPS, carries PII)
    LLM-->>App: comment draft
    App->>DB: persist Comment (generated)
    U->>T: post the comment manually on the channel (outside the system, D2)
    U->>App: mark posted
    App->>DB: Comment -> posted
```

## Components (C4 L3)

The component decomposition inside the single app container. Maintaining a level-3 view in living
canon, ahead of the code, is a deliberate, scoped exception to the usual "stop at L2" stance -
recorded in [ADR-0006](../adr/0006-pre-code-l3-component-view.md). It is a skeleton of the stable
seams, revised as features land; feature-internal detail stays in each capability's design, and the
build-enforced dependency-cruiser port/adapter rule (not this diagram) is the contract.

Everything blue is a component of the one app container; grey is external. Components are grouped by
their stable seam. A solid arrow is an in-process dependency (a call within the one Node process); a
dashed arrow is an adapter implementing a port (the dependency-inversion direction); an edge crossing
to an external system carries its wire protocol. All components read configuration via `config` and
emit logs via `log`; those ubiquitous edges are stated once here rather than drawn. The three
anchor-view nodes are RSC UI surfaces, not callable components; the named bands are grouping lenses by
role or seam, not containers.

> Interactive wireframes of these three anchor-view nodes (clickable, mock-data) live in
> [`src/app/prototype/`](../../src/app/prototype/README.md) - supplementary implementation sketches
> for settling UX, not canon. The component contract here governs; the registry there maps each
> screen to the capabilities it surfaces.

```mermaid
flowchart TB
    subgraph app["Wisery CRM app - one Node process (ADR-0001)"]
        direction TB

        subgraph web["Web / RSC surface - web role"]
            icp["ICP and source config<br/>anchor view #1"]
            plist["Prospect list<br/>anchor view #3"]
            queue["Review and approve queue<br/>anchor view #2"]
            handlers["Route handlers / Server actions<br/>RSC reads + outcome logging + enqueue scan"]
        end

        root["Composition root<br/>instrumentation.ts -> bootstrapNodeRuntime<br/>starts jobs, registers workers + adapters"]

        subgraph workers["Background pipeline - worker role (pg-boss handlers)"]
            hscan["scan handler"]
            hexpand["normalize-expand handler<br/>M2"]
            hqual["qualify handler"]
            henrich["enrich handler"]
            hdraft["draft handler"]
        end

        subgraph cores["Domain cores - role-agnostic, depend on db only"]
            cscan["signals pipeline<br/>dedup + persist + scan counts"]
            cqual["qualification core<br/>fan-out + score gate"]
            cenrich["enrichment core<br/>builds dossier"]
            cdraft["drafting core<br/>draft from dossier + profile"]
            cexpand["expansion core<br/>company -> people, M2"]
        end

        subgraph portgrp["Ports and registry - D4 / D9 seams"]
            psrc["SignalSource port + registry"]
            penr["EnrichmentProvider port"]
            pllm["LLMProvider port"]
        end

        subgraph adgrp["Adapters - reached only via registry / composition root"]
            afix["fixture connector<br/>test/dev only"]
            alink["linkedin-search"]
            ax["x-posts"]
            aapify["Apify enrichment"]
            abrow["self-host browser driver<br/>Playwright"]
            aanth["Anthropic adapter<br/>Structured Outputs"]
        end

        subgraph prompts["Prompts - src/prompts/&lt;name&gt;_v&lt;n&gt;"]
            pq["qualify prompt"]
            pd["draft prompt"]
        end

        subgraph platform["Platform facades - shared"]
            cfg["config<br/>src/lib/config"]
            db["db / Drizzle + repos<br/>src/lib/db"]
            jobs["jobs facade<br/>src/lib/jobs"]
            logc["log<br/>src/lib/log"]
        end
    end

    PG[("Managed Postgres")]
    SRC["Signal sources"]
    APIFY["Scraping / enrichment provider"]
    LLMX["LLM provider"]
    BROWSER["Headless browser<br/>separate OS process"]

    icp --> handlers
    plist --> handlers
    queue --> handlers
    handlers --> db
    handlers --> jobs

    root --> jobs
    root -->|"registers workers"| workers
    root --> psrc

    hscan --> cscan
    hexpand --> cexpand
    hqual --> cqual
    henrich --> cenrich
    hdraft --> cdraft

    cscan --> db
    cqual --> db
    cenrich --> db
    cdraft --> db
    cexpand --> db
    cexpand --> penr
    cscan --> psrc
    cqual --> pllm
    cqual --> pq
    cdraft --> pllm
    cdraft --> pd
    cenrich --> penr

    afix -.->|implements| psrc
    alink -.->|implements| psrc
    ax -.->|implements| psrc
    aapify -.->|implements| penr
    abrow -.->|implements| penr
    aanth -.->|implements| pllm

    db -->|"SQL, Postgres wire"| PG
    jobs -->|"SQL, Postgres wire"| PG
    alink -->|HTTPS| SRC
    ax -->|HTTPS| SRC
    aapify -->|HTTPS| APIFY
    abrow -->|"CDP over pipe"| BROWSER
    BROWSER -->|HTTPS| SRC
    aanth -->|HTTPS| LLMX

    classDef internal fill:#cfe3ff,stroke:#4a78b5,color:#10243e;
    classDef external fill:#ececec,stroke:#9a9a9a,color:#1f1f1f;
    classDef port fill:#d6f5e0,stroke:#3f9d6a,color:#10243e;
    classDef adapter fill:#fff0cc,stroke:#c79a3a,color:#3a2e10;
    classDef anchorview fill:#eaf1ff,stroke:#4a78b5,color:#10243e,stroke-dasharray:4 4;
    class handlers,root,hscan,hexpand,hqual,henrich,hdraft,cscan,cqual,cenrich,cdraft,cexpand,cfg,db,jobs,logc,pq,pd internal;
    class icp,plist,queue anchorview;
    class psrc,penr,pllm port;
    class afix,alink,ax,aapify,abrow,aanth adapter;
    class PG,SRC,APIFY,LLMX,BROWSER external;
```

**Legend.**

```mermaid
flowchart LR
    Li["Internal component"]
    Lav["Anchor view (RSC page)"]
    Lp["Port / seam"]
    La["Adapter"]
    Lx["External system"]
    A1[" "] -->|"in-process dependency"| A2[" "]
    B1[" "] -.->|"implements (DIP)"| B2[" "]

    classDef internal fill:#cfe3ff,stroke:#4a78b5,color:#10243e;
    classDef anchorview fill:#eaf1ff,stroke:#4a78b5,color:#10243e,stroke-dasharray:4 4;
    classDef port fill:#d6f5e0,stroke:#3f9d6a,color:#10243e;
    classDef adapter fill:#fff0cc,stroke:#c79a3a,color:#3a2e10;
    classDef external fill:#ececec,stroke:#9a9a9a,color:#1f1f1f;
    class Li internal;
    class Lav anchorview;
    class Lp port;
    class La adapter;
    class Lx external;
```

### Component catalog

| Component | Responsibility | Seam / port | Role | Owning capability |
|---|---|---|---|---|
| ICP and source config | Edit rubric, profile, and sources as data (anchor #1) | - | web | icp-config |
| Prospect list | Browse and manage prospects and signals (anchor #3) | - | web | prospect-list |
| Review and approve queue | Surface queued prospect + dossier + draft, log outcome (anchor #2) | - | web | review-queue |
| Route handlers / Server actions | RSC reads, the enqueue-scan trigger, outcome logging | reads `db`, calls `jobs` | web | each anchor view |
| Composition root | Start jobs, register workers and adapters - the only `kind -> instance` wiring point | `jobs`, `psrc` registry | boot | platform-runtime |
| scan handler -> signals pipeline | Claim source, run connector, dedup, persist, tally | `SignalSource` via registry | worker | signal-ingestion |
| qualify handler -> qualification core | Fan-out signal to person prospects, score against rubric, gate at >= 3 | `LLMProvider` | worker | qualification |
| enrich handler -> enrichment core | Deep-enrich a qualified prospect into a dossier | `EnrichmentProvider` | worker | enrichment |
| draft handler -> drafting core | Generate first-touch draft from dossier + profile | `LLMProvider` | worker | drafting |
| normalize-expand handler -> expansion core | Company / content -> people before qualify | `EnrichmentProvider` | worker | normalize-expand (M2) |
| SignalSource port + registry | The D4 connector contract + the `kind -> connector` map | port (D4) | both | signal-ingestion |
| EnrichmentProvider port | The D4 deep-enrich contract | port (D4) | worker | enrichment |
| LLMProvider port | Provider-neutral structured-output contract (D9, ADR-0003) | port (D9) | worker | llm-provider |
| Connectors (fixture [test/dev only], linkedin-search, x-posts) | Fetch + normalize one source kind | implement `SignalSource` | worker | source-adapters; fixture from signal-ingestion |
| Enrichment adapters (Apify, self-host browser) | Deep-enrich / scrape per the cost knob | implement `EnrichmentProvider` | worker | enrichment |
| Anthropic adapter | Default LLM via Structured Outputs + 1h cache | implements `LLMProvider` | worker | llm-provider |
| Prompts | Versioned qualify / draft prompts for `prompt_version` traceability | consumed by cores | worker | qualification, drafting |
| config / db / jobs / log | The reused platform facades - no parallel mechanisms | - | both | platform-runtime, background-jobs |
| Queue - triage lane | Approve/dismiss pending signals with the advisory hint (signals LEFT JOIN signal_decisions) | reads `db` | web | universal-triage |
| Feed | Monitored people's posts; draft + mark-posted comments inline (anchor #4) | reads `db` | web | engagement |
| advisory-filter handler -> filter core | Score a signal by the rubric matching its intent; advisory only, writes no Scoring row | `LLMProvider` (own queue) | worker | universal-triage |
| activity-scan dispatcher | Enqueue one fetch-posts job per monitored person (per-unit isolation) | `jobs` | worker | engagement |
| fetch-posts handler -> posts core | Fetch a person's posts, idempotent upsert on `(person_id, dedup_key)` | `EnrichmentProvider.fetchPosts` | worker | engagement |
| comment-generation core | Generate a comment from person info + guidance (synchronous server action, not a queue handler) | `LLMProvider` | web | engagement |
| Comment prompt | Versioned comment prompt for `prompt_version` traceability | consumed by the comment core | web | engagement |

For unbuilt capabilities only the seam, port, and owning capability are load-bearing here; their
internal shape is owned by each capability's design and is illustrative until that capability lands.

### Engagement and triage components (content-marketing-engagement)

The intake reframe and the engagement motion add components inside the same app container - no new
container or port ([ADR-0013](../adr/0013-universal-triage-intake.md)..[ADR-0018](../adr/0018-engagement-artifacts-post-comment.md)).
They follow the same port/adapter rules (cores depend on `db` only; adapters implement ports; wiring
only at the composition root), so they extend the skeleton above rather than redraw it.

- **Queue** gains a `kind` discriminator: the existing review-and-approve queue (anchor #2) is its
  **send lane** (`Person` rows where status = queued); a new **triage lane** reads pending signals
  (`signals LEFT JOIN signal_decisions`) plus the advisory result and records approve/dismiss. The two
  lanes share a nav surface, not a query, component state, or action handler (the same
  DRY-is-one-rule test that keeps Comment separate from Draft).
- **Feed** (anchor #4): a new RSC surface over monitored people's posts; opens a post detail
  (post + person-360) where comments are drafted and marked posted.
- **Person detail** gains the "get latest posts" action and the posts/comments history.
- **advisory-filter handler -> filter core**: its own capped-concurrency pg-boss queue; runs the
  rubric matching a signal's intent and writes the advisory result to the triage read-model
  (via `LLMProvider`), writing no `Scoring` row.
- **activity-scan dispatcher**: a cron handler that enqueues one fetch-posts job per monitored person
  (per-unit isolation), reusing the fetch-posts handler rather than looping over people in one job.
- **fetch-posts handler -> posts core**: post fetch via `EnrichmentProvider.fetchPosts` (a new method
  on the existing port, distinct from deep-profile enrich), idempotent upsert; serves the
  user-triggered and the activity-scan paths.
- **comment-generation core**: invoked synchronously by a Feed server action (not a queue handler);
  generates a comment from person info + the global comment guidance (via `LLMProvider`) using a
  versioned `src/prompts/comment_v<n>` prompt, writing a new `Comment` row per call - a transient LLM
  429 surfaces to the user (who retries), so there is no background retry that could double-bill.

The advisory filter, activity scan, and fetch-posts are observed in the existing jobs monitor
(ADR-0011/0012); comment generation, being a synchronous action, is observed via request logging.

### Web vs worker role mapping (ADR-0001 peel-safety)

The web and worker components run in one process today but are split into the two roles above so the
no-rewrite peel into a standalone `worker.ts` stays available. The peel-safety invariant: web and
worker components share state only through Postgres (rows + pg-boss jobs) - no module-level mutable
singletons, no in-process cache or event bus, no transaction spanning a request handler and a job.
The domain cores are deliberately role-agnostic and depend on `db` only, so the same core is callable
from a handler or a worker without dragging in queue or HTTP concerns. Where a stage must both write
rows and enqueue the next job - the qualify fan-out persisting N prospects and queuing their next
stage - the job handler, not the core, owns one Drizzle transaction passed to both the repo and
`jobs.enqueue` (pg-boss `send` shares the same Postgres), so the writes and their follow-on jobs
commit atomically while the core stays db-only. This is within a single job handler, so it does not
violate the no-transaction-spanning-a-request-and-a-job invariant. The self-host browser is a separate
OS process the browser adapter spawns on demand (ADR-0002), drawn as the external `Headless browser`
box.

### Ports and adapters direction

The dependency-inversion seam (enforced by dependency-cruiser): cores and ports MUST NOT import
adapters; adapters depend on (implement) ports, and an adapter is bound to a `kind`/provider only in
the registry wired from the composition root. This is why a new source or provider is a new adapter
file plus one registry line - never a change to a core, a port, or the pipeline. The rule exists for
`SignalSource` today; `enrichment` and `llm-provider` extend it to their ports when they land. The
build-enforced rule covers the adapter seam; the db-only and web/worker-share-only-via-Postgres
invariants are reviewed convention, not yet build-enforced (a cores-must-not-import-jobs rule is a
candidate to add when qualification lands).

### L3 runtime flow - scan slice internals

The internal view of the scan slice, revealing the handler/core/registry/port decomposition the
container view hides; consistent with the Prospect lifecycle (a SignalPersisted event with no further
enqueue yet, owned by qualification when it lands).

```mermaid
sequenceDiagram
    participant Boot as Composition root
    participant H as scan handler (worker role)
    participant Core as signals pipeline core
    participant Conn as connector adapter
    participant DB as db facade

    Note over Boot: registers adapters in the SignalSource registry (an in-process map), then registers the scan worker after startJobs
    Boot->>H: register scan worker
    Note over H: pg-boss delivers a source-scan job
    H->>Core: runScan(sourceId)
    Core->>DB: load source, open scan run
    Note over Core: resolve connector by source.kind from the registry (in-process lookup)
    loop each yielded RawItem
        Core->>Conn: scan yields normalized item
        Core->>Core: edge-validate with Zod
        Core->>DB: insert on conflict do nothing, returning
        Note over Core,DB: empty return = duplicate, counted dropped
    end
    Core->>DB: close scan run completed with counts
    Note over Core: no downstream qualify enqueue yet, job graph stays closed
```

### L3 runtime flow - cross-stage enqueue handoff

How one worker hands off to the next without importing it, and why a committed state
transition can never be stranded without its follow-on job. This is the dynamic view of
[ADR-0009](../adr/0009-atomic-enqueue-handoff.md) (atomic enqueue-in-transaction), resting on
[ADR-0004](../adr/0004-pg-boss-facade.md) (the pg-boss facade) and
[ADR-0001](../adr/0001-background-job-runtime.md) (in-process worker). The scan slice above is a
stage with no downstream enqueue yet; this is the qualify -> draft handoff once both stages exist.

Three invariants the diagram encodes:

- The pipeline topology lives only at the composition root: it injects a transaction-aware
  `enqueueNext(tx, ids)` callback into each stage, so a core imports no sibling stage (the
  drafting D-E seam). Changing the graph is a composition-root edit, not a core or queue edit.
- Any network / LLM / provider call a stage needs runs BEFORE the transaction opens; only DB
  writes are inside it.
- The follow-on job's INSERT rides the same Drizzle transaction as the state write via pg-boss's
  `fromDrizzle` adapter, so the transition and its next job commit together or roll back together.
  pg-boss's job table acts as a transactional outbox, atomic only because pg-boss shares the app's
  Postgres database (ADR-0009, ADR-0001).

```mermaid
sequenceDiagram
    participant Boot as Composition root (instrumentation.ts)
    participant PB as pg-boss (queues in the app Postgres)
    participant QH as qualify handler (worker role)
    participant QC as qualification core (db-only)
    participant LLM as LLM provider (external)
    participant DB as Postgres (app tables + pg-boss tables)
    participant DH as draft handler (worker role)
    participant DC as drafting core (db-only)

    Note over Boot: at startup registers each worker and injects enqueueNext(tx, ids), the only place that knows qualify to draft
    PB->>QH: deliver qualify job (singletonKey = signalId, one active per signal)
    QH->>QC: qualifySignal(signalId, enqueueNext)
    QC->>LLM: score the person (HTTPS, carries PII), OUTSIDE any transaction
    LLM-->>QC: score
    rect rgb(235, 245, 255)
        Note over QC,DB: one Drizzle transaction (ADR-0009)
        QC->>DB: write Prospect + Scoring (the state)
        QC->>PB: enqueueNext calls enqueueDraftInTx(tx), sending on the same tx so the job INSERT rides it
        QC->>DB: COMMIT, state and the draft job commit atomically
    end
    Note over QC,PB: process death or a failed send before COMMIT rolls BOTH back, no strand window
    PB->>DH: later, deliver draft job (prospectId)
    DH->>DC: draftProspect(prospectId)
    DC->>DB: write Draft, move Prospect status to queued (appears in the review-queue read-model)
    Note over DH,DC: a handler error propagates so pg-boss retries then dead-letters (ADR-0001), and singletonKey keeps it idempotent
```

Pipeline handoffs use `enqueueInTx` (atomic, above). User-triggered enqueues (a manual lead's
qualify, the "Regenerate draft" action) are not handoffs and use the fire-and-forget `enqueue`
instead: their failure surfaces to the user who retries, so they need no shared transaction
(ADR-0009). The same seam carries the policy branch the pipeline may grow: what a stage's
`enqueueNext` enqueues (or whether it enqueues at all) is decided at the composition root, so a
person that should not advance to drafting is a routing choice there, not a change to any core.
