# System-design view: out of scope for this change

No container or external-system change. The `EnrichmentProvider` port and the Apify deep-enrich actor are already in canon (ADR-0002; the C4 L2/L3 views in `docs/architecture/system-design.md`). This change alters only the *trigger* for enrichment - a user action or an opt-in auto setting, versus an automatic score-gated stage - which is a lifecycle/behavior concern captured in the domain-model view, not a topology change. The enrich job still runs in the in-process worker via the jobs facade, enqueued like the scan and qualify jobs.
