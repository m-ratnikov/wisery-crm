# Glossary (ubiquitous language)

The canonical noun for each domain concept - one term per concept. ONE glossary per bounded
context (we have one, the CRM core). The other views and the code use these terms.

Promoted from change `c4-level3-and-domain-model` (2026-05-26), extended by
`content-marketing-engagement` (2026-06-07: the engagement motion + universal triage) and re-cut by
`engagement-rework` (2026-06-08: the unified Queue, configurable pipelines, the Message entity, and
on-demand generation/scoring). Related:
[domain-model.md](domain-model.md), [system-design.md](system-design.md),
[product-overview.md](../product-overview.md).

- **Source**: a configured origin of signals (config-as-data) - its kind, connector configuration, optional schedule, enabled state.
- **Connector**: the module that fetches and normalizes one source kind; it implements the `SignalSource` port. Behavior, not data - not a table.
- **RawItem**: a normalized-but-un-deduped item a connector yields; a transient DTO between connector and dedup, never persisted.
- **Scan**: one isolated run of one source's connector, recorded with status and per-stage counts.
- **Signal**: a deduped, append-only, immutable fact that traces to its source and scan; the top of the funnel. No longer auto-fans-out - every signal awaits a human triage decision before any entity is created (ADR-0013).
- **SignalDecision**: the human triage verdict on a signal - `pending` (no row yet), `approved`, or `dismissed`. A separate, mutable entity from the immutable signal, so the scanner (which re-encounters the same deduped signal every run) can never reset a human decision (ADR-0014).
- **Queue**: the single intake surface - every fresh, undecided signal of every kind, advisory-scored and filterable by score (`signals LEFT JOIN signal_advisory LEFT JOIN signal_decisions`). Replaces the split Triage + Review & approve surfaces; a decided signal drops out. Approval creates the routed entity (and promotes the advisory score into the person's initial Scoring), dismissal records a `SignalDecision` (ADR-0019).
- **Person**: the renamed `Prospect` - a person the CRM user tracks. Carries `type` (prospect | peer) and a `monitored` flag, plus origin/status/identity. Widens the narrower "Prospect = a person under evaluation": a peer is tracked for engagement, not evaluation (ADR-0015).
- **Person type**: why the person is tracked - `prospect` (an outreach/ICP target, qualified against the ICP rubric and worked through the pipeline) or `peer` (an amplifier engaged via comments, scored against the peer rubric, not buyer-qualified). Orthogonal to `origin` and to `monitored`.
- **Monitored**: a flag marking a person whose posting activity the CRM user watches in the Feed. Independent of `type` - a prospect or a peer may be monitored.
- **Person origin**: which path produced a person - `signal` (fanned out from a Signal on triage approval) or `manual` (entered by hand, no Signal). `signal_id` is set iff origin is signal (ADR-0010).
- **Pipeline**: a configurable, ordered set of statuses a Person moves through (Breakcold-style kanban columns). Config-as-data, one default ("LinkedIn outreach") seeded from code, CRUD-able by the operator; People-scoped in v1 (ADR-0020).
- **Pipeline status**: one ordered column in a Pipeline (e.g. Cold, CR Sent, On Hold). CRUD-able; RESTRICT-deleted while any Person references it. `Person.status` is a foreign key into one of these (with `Person.pipeline_id` recording membership, a DB-enforced composite FK), not a fixed enum value (ADR-0020).
- **Person status**: the Person's current pipeline column - a `pipeline_status` FK the operator sets directly. Decoupled from scoring and from artifact existence; the entry status for a newly created person is the pipeline's entry column (`Cold` in the default). Replaces the retired fixed disposition enum (ADR-0020, supersedes ADR-0008).
- **Person identity**: the name and descriptive facets (headline/title, company, LinkedIn URL) read for a person - from `signals.payload` for a signal-derived person, from person columns for a manual one, surfaced through one read seam so consumers do not branch on origin.
- **Company**: a first-class entity created when a company signal is approved; firmographic identity. People may later link to it via a nullable `company_id` (expansion deferred) (ADR-0016).
- **Scoring**: a 1-5 ICP/peer rating event for a person (`-1` = insufficient data) with its reason, summary, the rubric version, the prompt/model that produced it, and a `provenance` (`llm | advisory`). Written at signal approval as an `advisory`-provenance initial assessment (the advisory score promoted to a real Scoring, no LLM) when an active rubric of the advisory's kind exists, and refreshed on demand by a re-score (`llm` provenance, buyer rubric). A manually created person gets no Scoring until its first on-demand re-score. Its own entity (a person can be scored more than once), not columns on Person. `advisory` rows power the qualification read but are excluded from the learning loop. The advisory triage hint shown *before* approval is still NOT a Scoring (ADR-0017, ADR-0019).
- **Qualification**: a derived read over a `prospect`-type Person's latest `icp`/buyer-rubric Scoring (latest by `scored_at`, tie-broken by `id`; the rubric-kind filter is part of the read) - `qualified` (score >= 3), `below_bar` (score < 3; the `-1` insufficient-data sentinel is `below_bar` by rule, distinct from `unassessed`), or `unassessed` (no `icp`-rubric Scoring row at all). It is `n/a` for a `peer`-type Person, never buyer-scored by design (ADR-0017). Not a stored status, and orthogonal to pipeline position (ADR-0019).
- **On-demand action**: a synchronous, user-triggered server action on the Person that writes one row per call (generate message, generate comment, re-score, enrich). No background job, no auto-generation, no retry/double-bill (ADR-0019).
- **Dossier**: the deep-enrichment research bundle for one person, built by the `EnrichmentProvider` on demand from the Person workspace.
- **Message**: a LinkedIn message generated for a Person, on demand, with a `type` (`connection_request` or `message` - a general DM). Many per person; they form the person's message history. A separate entity from Comment because it is keyed to a person, not a Post (ADR-0021).
- **Post**: a piece of a person's content (a LinkedIn/X post, or an approved standalone item), attached to a Person. Created on demand ("get latest posts") or by an activity scan, usually independent of any signal; a content-approval post traces to its signal via the author's `Person.signal_id` (ADR-0018).
- **Comment**: an AI-drafted reply to a Post, written from the person's full info and the global comment guidance. Regenerable, many per person (one or more per post). Human-posted (D2) - the CRM user posts it and marks it posted (ADR-0018).
- **Outcome**: a logged result of a human touch (connected, replied, booked, no-response), recorded against the score it acted on - the learning loop.
- **Rubric (ICP config)**: the scoring criteria as editable, versioned data; read by qualification. Carries a `kind` (icp | peer | company). Immutable once a Scoring references it - tuning creates a new version. At most one active per kind (ADR-0017).
- **Rubric kind**: the intent a rubric scores for - `icp` (buyer fit), `peer` (amplifier fit), or `company` (firmographic fit). The qualifier runs the rubric matching a signal's intent; results are advisory at triage.
- **Comment guidance**: the global tone and rules for comment generation - config-as-data held as a single versioned row, a peer of Rubric and User Profile (ADR-0018).
- **User Profile**: the operator's positioning, case studies, and voice as versioned data; read by message/comment generation for personalization.

`Draft` (the retired per-prospect, one-selected first-touch artifact) is gone: first-touch is now a **Message** generated on demand (ADR-0019, ADR-0021). The `drafts` table is frozen for historical `outcomes.draft_id` references only.

Config-as-data entities (per-tenant when productized): **Source**, **Rubric**, **User Profile**, **Comment guidance**, **Pipeline** (+ **Pipeline status**).
Runtime entities: **Scan**, **Signal**, **SignalDecision**, **Person**, **Company**, **Scoring**, **Dossier**, **Message**, **Post**, **Comment**, **Outcome**.
