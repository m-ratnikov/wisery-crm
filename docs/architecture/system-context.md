# System context (C4 L1)

The current C4 level 1 view: Wisery CRM as one box, its human actor, and every external
system it depends on. The action edge is deliberately drawn from the CRM user (not the
system) to the Prospect - the system never contacts a prospect directly.

Related: [product-overview.md](../product-overview.md) (the spine, locked decisions D1-D8),
[cross-cutting.md](cross-cutting.md), [ADR-0001](../adr/0001-background-job-runtime.md).
Promoted from change `system-context-c4-l1` (2026-05-22).

```mermaid
flowchart TB
    user["CRM user<br/>freelancer / solopreneur / developer / consultant"]
    prospect["Prospect<br/>end recipient"]

    subgraph boundary[" "]
        sys["Wisery CRM"]
    end

    src["Signal sources<br/>LinkedIn search, X, CSV, news, job boards"]
    dp["Scraping / enrichment provider<br/>optional, pluggable (e.g. Apify)"]
    llm["LLM API - Anthropic"]
    db[("Managed Postgres<br/>datastore")]

    user -->|"configure ICP, profile, sources; review + approve"| sys
    sys -->|"qualified prospects, dossier, optional draft"| user
    src -->|"raw source records"| sys
    sys -.->|"scrape / enrich (only when a provider is used)"| dp
    dp -.->|"normalized records / enrichment"| sys
    sys -->|"qualify and draft prompts"| llm
    llm -->|"scores and drafts"| sys
    sys <-->|"reads/writes app data"| db
    user -->|"acts manually via chosen channel"| prospect
```

What crosses each boundary:
- **CRM user <-> system**: inbound config (ICP, profile, sources) and approvals; outbound qualified prospects, dossiers, and optional drafts. This is the anchor-view surface.
- **Signal sources -> system**: inbound raw source records (a person, company, or piece of content), pulled per the connector seam (D4).
- **Scraping / enrichment provider <-> system** (optional, pluggable): when one is used, outbound scrape/enrich requests and inbound normalized records / enrichment, behind the D4 interfaces. Apify is one example; the system can instead self-host scraping (Puppeteer/Playwright) and reach sources directly, with no external provider. The same provider class can serve both signal capture and enrichment.
- **LLM API (Anthropic) <-> system**: outbound qualify/draft prompts, inbound scores and drafts. Carries prospect PII.
- **Managed Postgres <-> system**: the system's own managed datastore. Shown as a dependency because it is hosted, but it holds our own schema (not a third-party system of record). How async jobs run on it is an L2/technology concern, fixed by ADR-0001.
- **CRM user -> Prospect**: a manual human action through the chosen channel. The system has no edge to the Prospect (ToS-safe, D2).

## Boundary runtime flow

The daily loop at the boundary (the system stays one box; container-level sequences are L2).

```mermaid
sequenceDiagram
    actor U as CRM user
    participant S as Wisery CRM
    participant SRC as Signal source
    participant DP as Provider (optional)
    participant LLM as LLM API
    actor P as Prospect

    U->>S: configure ICP, profile, sources
    SRC->>S: raw source records (scan)
    opt a provider is used (else self-hosted scraping)
        S->>DP: expand / deep-enrich
        DP-->>S: people / enrichment
    end
    S->>LLM: qualify (and draft, if enabled)
    LLM-->>S: scores (and drafts)
    S->>U: surface qualified prospects + dossier + draft
    U->>P: act manually via chosen channel
    U->>S: log outcome
```

The "qualify (and draft, if enabled)" step is intentionally drawn without committing to
whether scoring and drafting are one LLM call or two - that is an internal-flow (C4 L2 /
qualification area) decision, open between D5 (one call) and a separate configurable step.

## Scope notes

- The L2 container view (web app, in-process worker, datastore, sidecars) and detailed
  runtime sequences are not yet drawn - a later L2 change. Whatever they are, they honor
  ADR-0001 (background jobs in-process).
- Entity shapes (ERD, lifecycle) are not modeled here; they belong to per-area domain-model
  changes.
