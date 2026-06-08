# Glossary (ubiquitous language)

The canonical noun for each domain concept - one term per concept. ONE glossary per bounded
context (we have one, the CRM core). The other views and the code use these terms.

Promoted from change `c4-level3-and-domain-model` (2026-05-26), extended by
`content-marketing-engagement` (2026-06-07: the engagement motion + universal triage). Related:
[domain-model.md](domain-model.md), [system-design.md](system-design.md),
[product-overview.md](../product-overview.md).

- **Source**: a configured origin of signals (config-as-data) - its kind, connector configuration, optional schedule, enabled state.
- **Connector**: the module that fetches and normalizes one source kind; it implements the `SignalSource` port. Behavior, not data - not a table.
- **RawItem**: a normalized-but-un-deduped item a connector yields; a transient DTO between connector and dedup, never persisted.
- **Scan**: one isolated run of one source's connector, recorded with status and per-stage counts.
- **Signal**: a deduped, append-only, immutable fact that traces to its source and scan; the top of the funnel. No longer auto-fans-out - every signal awaits a human triage decision before any entity is created (ADR-0013).
- **SignalDecision**: the human triage verdict on a signal - `pending` (no row yet), `approved`, or `dismissed`. A separate, mutable entity from the immutable signal, so the scanner (which re-encounters the same deduped signal every run) can never reset a human decision (ADR-0014).
- **Person**: the renamed `Prospect` - a person the CRM user tracks. Carries `type` (prospect | peer) and a `monitored` flag, plus origin/status/identity. Widens the narrower "Prospect = a person under evaluation": a peer is tracked for engagement, not evaluation (ADR-0015).
- **Person type**: why the person is tracked - `prospect` (an outreach/ICP target that flows through qualify -> draft -> send) or `peer` (an amplifier engaged via comments, scored against the peer rubric, not run through the outreach draft/send funnel). Orthogonal to `origin` and to `monitored`.
- **Monitored**: a flag marking a person whose posting activity the CRM user watches in the Feed. Independent of `type` - a prospect or a peer may be monitored.
- **Person origin**: which path produced a person - `signal` (fanned out from a Signal on triage approval) or `manual` (entered by hand, no Signal). `signal_id` is set iff origin is signal (ADR-0010).
- **Person identity**: the name and descriptive facets (headline/title, company, LinkedIn URL) read for a person - from `signals.payload` for a signal-derived person, from person columns for a manual one, surfaced through one read seam so consumers do not branch on origin.
- **Company**: a first-class entity created when a company signal is approved; firmographic identity. People may later link to it via a nullable `company_id` (expansion deferred) (ADR-0016).
- **Scoring**: a 1-5 ICP rating event for a person (`-1` = insufficient data) with its reason, summary, the rubric version, and the prompt/model that produced it. Created after approval, against the rubric matching the person's type (ICP for `prospect`, peer for `peer`). Its own entity (a person can be scored more than once), not columns on Person. The advisory triage hint is NOT a Scoring - it writes no Scoring row (ADR-0013, ADR-0017).
- **Dossier**: the deep-enrichment research bundle for one person, built by the `EnrichmentProvider`; grounds the draft.
- **Draft**: a generated first-touch message for a person, written from the dossier and user profile; regenerable. One is `selected` per person (a different business rule from Comment).
- **Post**: a piece of a person's content (a LinkedIn/X post, or an approved standalone item), attached to a Person. Created on demand ("get latest posts") or by an activity scan, usually independent of any signal; a content-approval post traces to its signal via the author's `Person.signal_id` (ADR-0018).
- **Comment**: an AI-drafted reply to a Post, written from the person's full info and the global comment guidance. Regenerable, many per person (one or more per post). Human-posted (D2) - the CRM user posts it and marks it posted (ADR-0018).
- **Outcome**: a logged result of a human touch (connected, replied, booked, no-response), recorded against the score it acted on - the learning loop.
- **Rubric (ICP config)**: the scoring criteria as editable, versioned data; read by qualification. Carries a `kind` (icp | peer | company). Immutable once a Scoring references it - tuning creates a new version. At most one active per kind (ADR-0017).
- **Rubric kind**: the intent a rubric scores for - `icp` (buyer fit), `peer` (amplifier fit), or `company` (firmographic fit). The qualifier runs the rubric matching a signal's intent; results are advisory at triage.
- **Comment guidance**: the global tone and rules for comment generation - config-as-data held as a single versioned row, a peer of Rubric and User Profile (ADR-0018).
- **User Profile**: the operator's positioning, case studies, and voice as versioned data; read by drafting for personalization.

Config-as-data entities (per-tenant when productized): **Source**, **Rubric**, **User Profile**, **Comment guidance**.
Runtime entities: **Scan**, **Signal**, **SignalDecision**, **Person**, **Company**, **Scoring**, **Dossier**, **Draft**, **Post**, **Comment**, **Outcome**.
