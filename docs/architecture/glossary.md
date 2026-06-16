# Glossary (ubiquitous language)

The canonical noun for each domain concept - one term per concept. ONE glossary per bounded
context (we have one, the CRM core). The other views and the code use these terms.

Promoted from change `c4-level3-and-domain-model` (2026-05-26), extended by
`content-marketing-engagement` (2026-06-07: the engagement motion + universal triage) and re-cut by
`engagement-rework` (2026-06-08: the unified Queue, configurable pipelines, the Message entity, and
on-demand generation), then narrowed by `adr-signal-only-scoring` (2026-06-13: person scoring removed,
the signal advisory is the only score, ADR-0022). Related:
[domain-model.md](domain-model.md), [system-design.md](system-design.md),
[product-overview.md](../product-overview.md).

- **Source**: a configured origin of signals (config-as-data) - its kind, connector configuration, optional schedule, enabled state.
- **Connector**: the module that fetches and normalizes one source kind; it implements the `SignalSource` port. Behavior, not data - not a table.
- **RawItem**: a normalized-but-un-deduped item a connector yields; a transient DTO between connector and dedup, never persisted.
- **Scan**: one isolated run of one source's connector, recorded with status and per-stage counts.
- **Signal**: a deduped, append-only, immutable fact that traces to its source and scan; the top of the funnel. No longer auto-fans-out - every signal awaits a human triage decision before any entity is created (ADR-0013).
- **SignalDecision**: the human triage verdict on a signal - `pending` (no row yet), `approved`, or `dismissed`. A separate, mutable entity from the immutable signal, so the scanner (which re-encounters the same deduped signal every run) can never reset a human decision (ADR-0014).
- **Queue**: the single intake surface - every fresh, undecided signal of every kind, advisory-scored and filterable by score (`signals LEFT JOIN signal_advisory LEFT JOIN signal_decisions`). Replaces the split Triage + Review & approve surfaces; a decided signal drops out. Approval creates the routed entity only - no score is written; the advisory score stays on the signal (ADR-0022). Dismissal records a `SignalDecision` (ADR-0019).
- **Person**: the renamed `Prospect` - a person the CRM user tracks. Carries `type` (prospect | peer) and a `monitored` flag, plus origin/status/identity. Widens the narrower "Prospect = a person under evaluation": a peer is tracked for engagement, not evaluation (ADR-0015).
- **Person type**: why the person is tracked - `prospect` (an outreach/ICP target worked through the pipeline; its originating signal was advisory-scored against the `icp` rubric) or `peer` (an amplifier engaged via comments; its originating signal was advisory-scored against the `peer` rubric). The score lives on the signal, not the person (ADR-0022). Orthogonal to `origin` and to `monitored`.
- **Monitored**: a flag marking a person whose posting activity the CRM user watches in the Feed. Independent of `type` - a prospect or a peer may be monitored.
- **Person origin**: which path produced a person - `signal` (fanned out from a Signal on triage approval) or `manual` (entered by hand, no Signal). `signal_id` is set iff origin is signal (ADR-0010).
- **Pipeline**: a configurable, ordered set of statuses a Person moves through (Breakcold-style kanban columns). Config-as-data, one default ("LinkedIn outreach") seeded from code, CRUD-able by the operator; People-scoped in v1 (ADR-0020).
- **Pipeline status**: one ordered column in a Pipeline (e.g. Cold, CR Sent, On Hold). CRUD-able; RESTRICT-deleted while any Person references it. `Person.status` is a foreign key into one of these (with `Person.pipeline_id` recording membership, a DB-enforced composite FK), not a fixed enum value (ADR-0020).
- **Person status**: the Person's current pipeline column - a `pipeline_status` FK the operator sets directly. Decoupled from artifact existence (and from any score - a person has none); the entry status for a newly created person is the pipeline's entry column (`Cold` in the default). Replaces the retired fixed disposition enum (ADR-0020, supersedes ADR-0008).
- **Person identity**: the name and descriptive facets (headline/title, company, LinkedIn URL) read for a person - from `signals.payload` for a signal-derived person, from person columns for a manual one, surfaced through one read seam so consumers do not branch on origin.
- **Company**: a first-class entity created when a company signal is approved; firmographic identity. People may later link to it via a nullable `company_id` (expansion deferred) (ADR-0016).
- **Advisory score**: the per-signal fit hint computed at triage by the advisory filter - a 1-5 rating (`-1` = insufficient data, or absent when no rubric of the signal's kind is active) against the rubric matching the signal's intent (`icp` for a person signal, `peer` for content, `company` for a company), with a reason. It is the **only score in the system** (ADR-0022): it informs the human's approve/dismiss verdict and stays on the signal (the `signal_advisory` row, one per signal, refreshed in place by the job). It is never copied onto a created entity, and a person carries no score of its own. The human's verdict at triage is the qualification - there is no derived qualification read (ADR-0017, ADR-0022).
- **On-demand action**: a synchronous, user-triggered server action on the Person that writes one row per call (generate message, generate comment, enrich). No background job, no auto-generation, no retry/double-bill (ADR-0019).
- **Dossier**: the deep-enrichment research bundle for one person, built by the `EnrichmentProvider` on demand from the Person workspace.
- **Message**: a LinkedIn message generated for a Person, on demand, with a `type` (`connection_request` or `message` - a general DM). Many per person; they form the person's message history. A separate entity from Comment because it is keyed to a person, not a Post (ADR-0021).
- **Post**: a piece of a person's content (a LinkedIn/X post, or an approved standalone item), attached to a Person. Created on demand ("get latest posts") or by an activity scan, usually independent of any signal; a content-approval post traces to its signal via the author's `Person.signal_id` (ADR-0018).
- **Comment**: an AI-drafted reply to a Post, written from the person's full info and the global comment guidance. Regenerable, many per person (one or more per post). Human-posted (D2) - the CRM user posts it and marks it posted (ADR-0018).
- **Outcome**: a logged result of a human touch (connected, replied, booked, no-response), bound to the person and the artifact acted on. It snapshots no score (ADR-0022); the deferred D7 learning loop will bind to signal advisory data when it is designed.
- **Rubric (ICP config)**: the scoring criteria as editable, versioned data; read by the advisory filter (its only consumer). Carries a `kind` (icp | peer | company). At most one active per kind. Versioning is retained as config history; with person scoring removed nothing references a rubric version, so the "immutable once referenced" invariant is dormant until a future learning-grade record re-establishes a version pin (ADR-0017, ADR-0022).
- **Rubric kind**: the intent a rubric scores for - `icp` (buyer fit), `peer` (amplifier fit), or `company` (firmographic fit). The advisory filter runs the rubric matching a signal's intent; the result is the advisory score, always a hint, never a gate.
- **Comment guidance**: the global tone and rules for comment generation - config-as-data held as a single versioned row, a peer of Rubric and User Profile (ADR-0018).
- **User Profile**: the operator's positioning, case studies, and voice as versioned data; read by message/comment generation for personalization.

`Draft` (the retired per-prospect, one-selected first-touch artifact) is gone: first-touch is now a **Message** generated on demand (ADR-0019, ADR-0021). The `drafts` table is frozen for historical `outcomes.draft_id` references only.

Config-as-data entities (per-tenant when productized): **Source**, **Rubric**, **User Profile**, **Comment guidance**, **Pipeline** (+ **Pipeline status**).
Runtime entities: **Scan**, **Signal**, **SignalDecision**, **SignalAdvisory** (the advisory score), **Person**, **Company**, **Dossier**, **Message**, **Post**, **Comment**, **Outcome**.
