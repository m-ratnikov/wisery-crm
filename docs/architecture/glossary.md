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
- **Prospect**: a person under evaluation, derived from a signal or entered manually by the CRM user (ADR-0010); the unit that moves through the pipeline. Carries its pipeline status and its origin, not its score.
- **Prospect origin**: which path produced a prospect - `signal` (fanned out from a Signal) or `manual` (entered by hand, no Signal). `signal_id` is set iff origin is signal.
- **Person identity**: the name and descriptive facets (headline/title, company, LinkedIn URL) read for a prospect - from `signals.payload` for a signal-derived prospect, from prospect columns for a manual one, surfaced through one read seam so consumers do not branch on origin.
- **Scoring**: a 1-5 ICP rating event for a prospect (`-1` = insufficient data) with its reason, summary, the rubric version, and the prompt/model that produced it. Its own entity (a prospect can be scored more than once - e.g. when the rubric is tuned), not columns on Prospect.
- **Dossier**: the deep-enrichment research bundle for one prospect, built by the `EnrichmentProvider`; grounds the draft.
- **Draft**: a generated first-touch message for a prospect, written from the dossier and user profile; regenerable.
- **Outcome**: a logged result of a human touch (connected, replied, booked, no-response), recorded against the score it acted on - the learning loop.
- **Rubric (ICP config)**: the scoring criteria as editable, versioned data; read by qualification. Immutable once a Scoring references it - tuning creates a new version.
- **User Profile**: the operator's positioning, case studies, and voice as versioned data; read by drafting for personalization.

Config-as-data entities (per-tenant when productized): **Source**, **Rubric**, **User Profile**.
Runtime entities: **Scan**, **Signal**, **Prospect**, **Scoring**, **Dossier**, **Draft**, **Outcome**.
