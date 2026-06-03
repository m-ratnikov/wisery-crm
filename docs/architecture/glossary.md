# Glossary (ubiquitous language)

The canonical noun for each domain concept - one term per concept. ONE glossary per bounded
context (we have one, the CRM core). The other views and the code use these terms.

Promoted from change `c4-level3-and-domain-model` (2026-05-26). Related:
[domain-model.md](domain-model.md), [system-design.md](system-design.md),
[product-overview.md](../product-overview.md).

- **Source**: a configured origin of signals (config-as-data) - its kind, connector configuration, optional schedule, enabled state.
- **Connector**: the module that fetches and normalizes one source kind; it implements the `SignalSource` port. Behavior, not data - not a table.
- **RawItem**: a normalized-but-un-deduped item a connector yields; a transient DTO between connector and dedup, never persisted.
- **Scan**: one isolated run of one source's connector, recorded with status and per-stage counts.
- **Signal**: a deduped, append-only, immutable fact that traces to its source and scan; the top of the funnel.
- **Prospect**: a person under evaluation, derived from a signal; the unit that moves through the pipeline. Carries its pipeline status, not its score.
- **Scoring**: a 1-5 ICP rating event for a prospect (`-1` = insufficient data) with its reason, summary, the rubric version, and the prompt/model that produced it. Its own entity (a prospect can be scored more than once - e.g. when the rubric is tuned), not columns on Prospect.
- **Dossier**: the deep-enrichment research bundle for one prospect, built by the `EnrichmentProvider`; grounds the draft.
- **Draft**: a generated first-touch message for a prospect, written from the dossier and user profile; regenerable.
- **Outcome**: a logged result of a human touch (connected, replied, booked, no-response), recorded against the score it acted on - the learning loop.
- **Rubric (ICP config)**: the scoring criteria as editable, versioned data; read by qualification. Immutable once a Scoring references it - tuning creates a new version.
- **User Profile**: the operator's positioning, case studies, and voice as versioned data; read by drafting for personalization.

Config-as-data entities (per-tenant when productized): **Source**, **Rubric**, **User Profile**.
Runtime entities: **Scan**, **Signal**, **Prospect**, **Scoring**, **Dossier**, **Draft**, **Outcome**.
