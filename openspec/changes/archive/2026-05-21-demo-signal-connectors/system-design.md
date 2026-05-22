## System context (C4 L1)

```mermaid
flowchart TB
    consultant["Consultant"] --> sys["Wisery CRM"]
    sys --> src1["External source: scraper (Apify)"]
    sys --> src2["External source: RSS / API"]
    sys --> db[("Managed Postgres")]
```

Each external source crosses the boundary as raw fetched payloads; the system owns
normalization. Postgres holds Source config, Scans, and Signals.

## Containers (C4 L2)

```mermaid
flowchart TB
    web["Next.js web app"] -->|writes Source config| db[("Postgres")]
    worker["pg-boss worker (in-process)"] -->|claims scans, writes Signals| db
    worker -->|invokes| conn["Connector registry"]
    conn -->|fetch| ext["External source"]
```

Honors ADR-0001: the worker is in-process pg-boss on Postgres. Connectors are plain
modules the worker calls; they are not separate services.

## Key runtime flows

```mermaid
sequenceDiagram
    participant J as Scan job (pg-boss)
    participant C as Connector
    participant E as External source
    participant D as Postgres
    J->>C: run(sourceConfig)
    C->>E: fetch (auth + paging owned by connector)
    E-->>C: raw payloads
    C-->>J: RawItem[] (normalized)
    loop each RawItem
        J->>D: dedup key lookup
        alt new
            J->>D: insert Signal
        else duplicate
            J->>J: drop (increment counter)
        end
    end
```

Consistent with the domain-model lifecycle (Fetched -> Normalized -> Deduped ->
Persisted/Dropped) and the stories primary journey.

## Decisions and trade-offs

- **Connector contract = normalized RawItem in, source owns auth/paging**: chose a thin
  normalize-at-the-edge contract over passing raw vendor payloads downstream, because it
  keeps dedup/qualify source-agnostic. Trade-off accepted: each new source type needs a
  connector module (some code), not pure config.
- **One scan job per source**: chose per-source jobs over one mega-scan, because pg-boss
  job isolation gives the failure isolation QA for free. Trade-off: more job rows.

## Cross-cutting concerns

- Observability: per-scan structured logs (pino, ADR-0002); RawItemDropped counter per source.
- Configuration: Source config is config-as-data in Postgres (ADR-0003 for app config/secrets).
- Secrets: per-source credentials referenced by config, resolved at scan time (see config ADR).
- Failure handling: a scan job failure is isolated to that source; pg-boss retries with dead-letter.
- Trust boundaries: external sources are untrusted; connectors validate/normalize before persistence.
- Data sensitivity: RawItems may carry PII; only deduped Signals persist, scoped per tenant.
- Scaling / capacity: per-source jobs let the worker peel into a standalone process later (ADR-0001) without contract change.
