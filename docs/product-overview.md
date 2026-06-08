# Wisery CRM - Product Overview

Status: Draft, captured from an explore session on 2026-05-20. Not yet implemented.

This is the north-star architecture for the MVP. It supersedes parts of the older
planning docs (see "Relationship to existing docs" at the end). Individual scoped
changes are tracked separately as OpenSpec changes; this document is the spine they
hang off.

## 1. What this is

A neo agentic CRM for freelancers, solopreneurs, builders, consultants, and fractional CTOs/CXOs.
One place to find clients and automate the work around it: research, outreach, and
(later) content marketing.

It replaces a 5-tool Make.com + Airtable + Zapier + Octopus + Breakcold stack with a
single system of record and a single pipeline.

### The reframe (the load-bearing decision)

The earlier planning docs scoped this as a personal tool, single-user, productization
deferred. This is now reframed as **a product for other CRM users - freelancers,
solopreneurs, developers, consultants - built single-user first.** Everything personal to
one CRM user (ICP, profile, case studies, voice) becomes per-tenant configuration. The
first CRM user (Michael) is just tenant #1's config.

## 2. Core thesis

- **Automate the intelligence, keep the action human.** The previous automation failed
  at the action layer (mass automated LinkedIn connect/DM via Octopus: 250 messages,
  ~18% accept, 0 calls, and ban risk). The valuable half was the intelligence: find,
  qualify, enrich, personalize, track. Rebuild that; the human still clicks send.
  This is also what `gtm.md` mandates ("no third-party automation tools", quality over
  volume), so the constraint and the strategy agree.
- **Minimal interface + generative outputs.** Hand-built anchor views exist only where
  judgment lives: ICP/profile config, the lead list, and the unified Queue.
  Everything else is background jobs and generative output.
- **Quality over volume is a feature, not a limitation.** The product encodes
  "10 genuine relationships > 250 automated messages" rather than fighting it.

## Personas

The durable human actors the product serves. The external systems it depends on - signal
sources, the optional scraping/enrichment provider, the LLM provider - are drawn as actors
in [docs/architecture/system-context.md](architecture/system-context.md); the two human
personas are:

- **CRM user (primary operating persona)** - a freelancer, solopreneur, developer,
  consultant, or other operator running outreach for their own book of business (tenant #1).
  Wants qualified prospects and AI assistance on demand (a generated message or comment, a re-score,
  an enrich) without wiring five tools together, and acts manually to stay within each channel's terms
  of service. Everything personal to one CRM user (ICP, profile, case studies, voice) is per-tenant
  config-as-data (D1).
- **Prospect (end recipient)** - the person who ultimately receives the human-sent touch,
  through whatever channel it targets (LinkedIn first). Two facts shape the system boundary:
  their personal data enters the system (third-party PII), and they are reached only by a
  manual human action, never automated sending (D2). The same boundary holds for an **engagement
  target** - a peer or buyer whose post the CRM user comments on: their post data enters the system,
  and the human posts every comment by hand (D2).

## Primary journey

The daily loop. "Anchor view" = one of the few hand-built UI screens the product commits to
(ICP/profile config, lead list, the unified Queue, the Feed); everything else is background jobs or
generative output (the thesis above). The runtime flows in
[docs/architecture/system-design.md](architecture/system-design.md) and the boundary flow in
[system-context.md](architecture/system-context.md) are dynamic views of this journey and
must stay consistent with it.

1. Configure ICP, profile, and signal sources - anchor view: config (occasional).
2. Pull raw source records from the configured sources - background job: signal scan; an advisory,
   type-keyed rubric scores each new signal by intent.
3. Triage the unified **Queue**: approve (Create a Person, a Company, or a peer-author + Post) or
   dismiss - every signal waits, no per-source bypass; a decided item drops out. Approval creates the
   entity and promotes the signal's advisory score into the person's `advisory`-provenance initial
   assessment Scoring (no LLM) when an active rubric of its kind exists - anchor view: the Queue
   ([ADR-0013](adr/0013-universal-triage-intake.md), [ADR-0019](adr/0019-generation-and-scoring-on-demand.md)).
4. Open a person and work them in the **workspace** - all on demand, each a synchronous action that
   writes one row: generate a LinkedIn message (connection-request or DM, ADR-0021), generate a comment
   on a post, re-score against the ICP (the durable LLM Scoring), or deep-enrich into a dossier
   ([ADR-0007](adr/0007-user-triggered-optional-enrichment.md), [ADR-0019](adr/0019-generation-and-scoring-on-demand.md)).
   Qualification (qualified / below_bar / unassessed) is a derived read over the latest ICP Scoring, not
   a stored status.
5. Move the person through a **configurable pipeline** by setting its status (the seeded "LinkedIn
   outreach" default is Cold .. On Hold, CRUD-able) - status is decoupled from whether any message,
   comment, or dossier exists ([ADR-0020](adr/0020-configurable-pipelines-for-person-status.md)).
6. Post the generated message or comment manually through the channel and log the outcome against the
   score - manual, ToS-safe (D2, D7).

Alongside the outreach loop, the **engagement motion**: flag a person `monitored`, fetch or scan their
recent posts into the **Feed** (anchor view), open a post, generate an AI comment grounded in the
person's info and the global comment guidance, edit it, and post it manually - the human posts every
comment (D2). Peers are tracked and scored against the peer rubric for engagement, not buyer-qualified
(ADR-0015 / ADR-0017 / ADR-0018).

Throughout, the CRM user works from the person/company list (an anchor view) to filter,
tag, and open dossiers.

An interactive, clickable view of this journey is being assembled as the prototype app
([`src/app/prototype/`](../src/app/prototype/README.md)); each anchor view is mocked there before
it is wired.

## 3. Locked decisions

| # | Decision | Why |
|---|----------|-----|
| D1 | Product for CRM users, built single-user. Defer auth, billing, tenant isolation. | The expensive multi-tenant plumbing is additive. Only discipline kept now: config-as-data. |
| D2 | Automate intelligence; the LinkedIn action stays human-assisted. | The old stack's failure and ban risk were entirely in the action layer. ToS-safe, GTM-aligned. |
| D3 | Signals are the top of funnel, not CSV. | Crunchbase ($100/mo) is gone. Signal listening also fuels the comment-first motion. |
| D4 | All scraping/enrichment behind one `SignalSource` / `EnrichmentProvider` interface. Self-host Puppeteer/Playwright for cheap/public sources, Apify for authenticated/deep. | A port of `job-monitor`'s `ScraperBase`. Per-source cost knob; Apify keeps detection risk off the user's own account. (ADR-0002) |
| D5 | Qualifier = port of `job-monitor`'s static 1-5 ICP scorer (gate at >= 3, platform-aware, structured output, anti-hallucination). The advisory, type-keyed rubric scores each signal at triage as a hint. The durable per-person Scoring is **on-demand**, not an automatic post-approval stage: at approval the signal's advisory score is **promoted** into the person's `advisory`-provenance initial Scoring (no LLM) when an active rubric of its kind exists; a fresh `llm`-provenance Scoring is written only when the user clicks re-score; manual entry is not auto-scored. Qualification (qualified / below_bar / unassessed) is a derived read over the latest ICP Scoring, not a stored status. The score is per person (a Scoring against the prospect), not on the shared signal (ADR-0005, superseded by ADR-0010 which adds the manual origin). The drafting stage that once split off a separate first-touch LLM call is removed; first-touch is an on-demand Message ([ADR-0019](adr/0019-generation-and-scoring-on-demand.md), [ADR-0021](adr/0021-linkedin-message-entity.md), partially superseding ADR-0007's auto-enrich-on-qualify, ADR-0013's post-approval qualify-enqueue, ADR-0017's only-qualify-persists-a-Scoring mechanism, and ADR-0010's manual auto-score). | Proven, cheap scorer, already written (M2). On-demand generation/scoring replaces the auto pipeline per the owner's model (2026-06-08); enrichment made optional/user-triggered by ADR-0007 (2026-06-01); manual-origin prospects added by ADR-0010 (2026-06-04). |
| D6 | The ICP rubric becomes config-as-data, not a hardcoded prompt. | Required for reuse by other CRM users and for the config UI. |
| D7 | Log outcomes against scores from day one; outcome-driven tuning of the bar is a later additive milestone. The `advisory`-provenance initial Scoring (and any Outcome bound to it) is excluded from the learning loop via `scorings.provenance`, so the cheap advisory pass never tunes the bar ([ADR-0019](adr/0019-generation-and-scoring-on-demand.md), preserving ADR-0017's purpose). | Lets the feedback loop become additive, not a migration. The learning loop is the "neo" differentiator. |
| D8 | Entry point is configurable: multiple source types (LinkedIn search, CSV of companies, Google alerts, X posts, ...). | Already proven across 11 platforms in `job-monitor`. A new source is a new adapter, not a new pipeline. |
| D9 | LLM access is provider-agnostic behind an `LLMProvider` port: a provider-neutral structured-output contract (JSON Schema + Zod), with Anthropic as the default adapter, not a binding. | Avoid single-vendor lock-in on the highest-value path (scoring + on-demand generation); the contract is provider-neutral anyway. (ADR-0003) |
| D10 | PII field minimization and sub-processor controls attach at the qualify boundary; earlier pipeline stages do not constrain data shape. Provisional, deferred until productization. | Single designated seam for data-processor controls when productized; avoids scattering minimization across adapters. (D1; system-design cross-cutting) |
| D11 | Universal triage is the intake gate: every signal awaits a human approve/dismiss before any entity is created; no per-source bypass. The ICP score is advisory at triage, not an auto-gate. This runs in **one unified Queue** - the sole intake surface; the separate Review & approve queue is removed (there is no automatic drafting output to review). | Keeps the human in control of what enters the CRM as broad/noisy sources and peers (not just buyers) join the funnel; reworks the shipped auto-fan-out-then-auto-gate intake. ([ADR-0013](adr/0013-universal-triage-intake.md), refining ADR-0005's fan-out trigger; with ADR-0014..0018 for the engagement motion; the unified Queue + removed review surface per [ADR-0019](adr/0019-generation-and-scoring-on-demand.md).) |
| D12 | Generation, scoring, and enrichment are **on-demand Person actions**, not automatic pipeline stages: each is a synchronous server action writing one row per click, with LLM/Apify spend only on that click. Approval promotes the advisory score (no LLM); manual entry does not auto-score; the drafting stage, the `draft` worker, the `queued` status, the Review & approve queue, and the durable `qualify-prospect` worker are all retired. | Generation is a feature of the person, not a funnel position; an auto stage spent budget drafting people the user may never contact. Owner directive (2026-06-08). ([ADR-0019](adr/0019-generation-and-scoring-on-demand.md), supersedes-in-part ADR-0007/0010/0013/0017.) |
| D13 | Person status is a **configurable pipeline**: `Person.status` is a FK into a seeded-but-CRUD-able `pipeline_status` (Breakcold-style kanban), not a fixed enum. The seeded default "LinkedIn outreach" pipeline is Cold, CR Sent, CR Accepted, FU Sent, Conversation, Discovery call, Not Interested, Ghosted, Proposal Sent, On Hold (entry = Cold). | The product is a configurable sales CRM; a fixed seven-value enum cannot express a tenant's pipeline. ([ADR-0020](adr/0020-configurable-pipelines-for-person-status.md), supersedes ADR-0008.) |
| D14 | LinkedIn outreach is a **Message** entity (connection-request and DM are message types), a sibling of the post-linked Comment, generated on demand. The channel discriminator vs per-channel-table choice is deferred (NC1). | A message's rule (keyed to a person, many per person, carrying a type) differs from a comment's (keyed to a Post); merging loses that. v1 ships LinkedIn-only. ([ADR-0021](adr/0021-linkedin-message-entity.md), refines ADR-0018.) |

## 4. Pipeline architecture

```
  [ configurable source adapters ]  ── raw items (person | company | content)
                 │
                 ▼
  SIGNALS (deduped, immutable) ──► ADVISORY FILTER (type-keyed rubric: icp | peer | company; advisory hint only)
                 │
                 ▼
  THE QUEUE  [ THE SOLE HUMAN INBOX ]  Create Person/Company / dismiss
   every signal waits, no per-source bypass (ADR-0013); a decided item drops out
                 │ approve routes by signal kind, promoting the advisory score
                 │ into the person's advisory-provenance initial Scoring (no LLM, ADR-0019):
                 │   company ─► COMPANY (no Scoring)
                 │   content ─► PERSON(type = peer) + POST
                 │   person  ─► PERSON(type = prospect)
                 ▼
  PERSON WORKSPACE  [ on-demand actions, each one synchronous click, ADR-0019 ]      ENGAGEMENT MOTION
   ├─ generate MESSAGE (connection-request | DM, ADR-0021)                            monitor ─► fetch / scan POSTS ─► FEED
   ├─ generate COMMENT on a post (ADR-0018)                                            ─► AI COMMENT ─► you post it (manual, D2)
   ├─ RE-SCORE vs the ICP (durable llm Scoring; qualification is a read)
   ├─ DEEP ENRICH ─► dossier (optional, ADR-0007)
   └─ set PIPELINE STATUS (configurable: Cold .. On Hold, ADR-0020)
                 │
                 ▼
   you post it (manual, ToS-safe) ─► TRACK + measure outcomes vs the score (D7)
```

Under universal triage every signal lands in the one Queue; an advisory, type-keyed rubric hint helps
the human decide, but never auto-gates (ADR-0013/0017). Approval routes by kind to a Person, a Company,
or a peer-author + Post, and promotes the advisory score into the person's initial Scoring (no LLM,
ADR-0019). Post-intake, the person is worked in a **workspace** where generation, re-scoring, and
enrichment are on-demand actions - each a synchronous click that writes one row, spend incurred only on
that click ([ADR-0019](adr/0019-generation-and-scoring-on-demand.md)). Status is a **configurable
pipeline** the operator sets directly ([ADR-0020](adr/0020-configurable-pipelines-for-person-status.md)),
decoupled from whether any artifact exists. The engagement motion runs alongside: monitor a person,
fetch or scan their posts into a Feed, generate an AI comment, and post it by hand
([ADR-0018](adr/0018-engagement-artifacts-post-comment.md), D2).

Anchor views (the only hand-built UI): **ICP/profile config, the person list + workspace, the unified
Queue, and the Feed.** Everything else is jobs + generative output.

The system-level boundary view - the system as one box, its actors, and the external
systems it depends on - is in [docs/architecture/system-context.md](architecture/system-context.md).
The container-level view (C4 L2) - the runnable units inside the box and the runtime flows - is in
[docs/architecture/system-design.md](architecture/system-design.md).

### Source types resolve to different entities

The entry point is configurable, but sources do not emit the same shape. This is why a
normalize + expand layer sits before the qualifier.

| Source | Emits | Extra step before qualify |
|--------|-------|---------------------------|
| LinkedIn search | person | none |
| X posts | person (post -> author) | none |
| CSV of companies | company | expand: company -> people (Apify) |
| Google alerts / news | content | extract entity -> resolve -> expand |

Data-model consequence: a **signal / raw item is not a lead**. One company signal fans
out to N person leads (one-to-many) - the fan-out invariant frozen in
[ADR-0005](adr/0005-signal-to-prospect-fan-out.md). A prospect may also originate **without a
signal at all** - a lead the CRM user adds by hand - so `signal_id` is nullable and a prospect
carries an `origin` ([ADR-0010](adr/0010-prospect-origin-signal-or-manual.md), superseding
ADR-0005's signal_id-NOT-NULL totality while preserving the fan-out). Model both from the start.

Canonical nouns: **Source** (configured origin, config-as-data), **Connector** (module that
fetches and normalizes one source type), **RawItem** (normalized, un-deduped), **Signal**
(deduped, persisted), **SignalDecision** (the human triage verdict on a signal), **Person** (renamed
from Prospect - a tracked person with a `type` of prospect or peer; fanned out from a signal on
approval, or entered manually), **Company** (first-class, created when a company signal is approved),
**Scoring** (the per-person ICP/peer rating, carrying a `provenance` of `llm` or `advisory`),
**Message** (an on-demand LinkedIn message, connection-request or DM), **Post** and **Comment** (the
engagement artifacts - a person's content and the AI-drafted, human-posted reply), **Pipeline** /
**Pipeline status** (the configurable status vocabulary), **Comment guidance** (global comment config).
The connector boundary - how a source plugs in - is the single, pluggable interface of D4. The full data model (ERD, lifecycle, events) is promoted in
[docs/architecture/domain-model.md](architecture/domain-model.md) and the ubiquitous language in
[docs/architecture/glossary.md](architecture/glossary.md).

### Cost gate flips for company/content sources

- Person sources: cheap scan -> cheap qualify -> deep-enrich only the >= 3s. The gate
  works perfectly.
- Company/content sources: you must spend Apify expansion *before* you can qualify
  anyone, so you risk enriching a company whose every employee scores 1. Mitigation
  (exactly what the old Make flow lacked): pre-check the company against the ICP first
  (cheap firmographics), and only expand decision-maker-title roles, not the whole org.

### Backend cost knob (D4)

```
  broad signal scan   HIGH volume   public/unauth (jobs API, HN, YC) -> self-host, ~free
                                    authenticated LinkedIn posts/people -> Apify (safe)
                                                              or self-host w/ cookies (cheap, ban-risk)
  deep enrichment     LOW volume    company -> people -> full profile -> Apify (pay per high-value prospect)
```

## 5. The qualifier (port vs upgrade)

Port almost verbatim from `cto-practice/tools/job-monitor/icp-score.mjs`:
- One batched Claude call, structured output (`id, score, reason, summary, cr_message`).
- Bar at score >= 3 (1-2 silent, 3-5 surfaced).
- Platform-aware rubric (same person scores differently as a post vs a people-search
  result vs an Upwork job).
- Anti-hallucination guard (score -1 / INSUFFICIENT_DATA on thin data).
- In job-monitor, qualify and the first-touch draft were one call; here scoring and generation are fully separated - scoring is the re-score action (and the no-LLM approval promotion), generation is the on-demand Message (see Upgrade, ADR-0019).

Upgrade three things:
- Move the rubric out of a hardcoded prompt into ICP config-as-data (D6).
- Persist outcomes (connected? replied? booked?) against each score (D7).
- Separate scoring from generation entirely: a Scoring is the no-LLM advisory promotion at approval plus the on-demand re-score; first-touch is a separately generated on-demand Message, never bundled into the score call (D5, D12).

## 6. Reuse map (existing assets -> product)

| Existing asset (cto-practice) | Becomes |
|-------------------------------|---------|
| `tools/job-monitor` (`ScraperBase`, `config.mjs` SEARCHES, Apify + self-host adapters) | The signal/enrichment engine, rebuilt clean behind the source interface |
| `tools/job-monitor/icp-score.mjs` | The qualifier (M2) |
| `config.mjs` SEARCHES + `ICP_SYSTEM_PROMPT` | The "ICP configuration section" UI, turned from code into editable data |
| `gtm.md` + CLAUDE.md profile + case studies | ICP config + User Profile (config-as-data) |
| `/post`, `/carousel`, `/banner`, `/buffer` | Content surface (later) |
| `/cv`, `/cv-batch` | CV/case-study generation (also feeds personalization) |
| `/bid`, `/bid-batch` | Bidding surface (later) |
| `li-proxy` (VNC login + cookie extraction) | The authenticated-LinkedIn access path for self-host adapters |

## 7. Multi-tenant readiness (what is skipped now)

Build none of these now (all additive later): auth/sessions, tenant isolation
(`tenant_id` scoping, row-level security), signup/onboarding, billing, per-tenant
secret vaults, admin/impersonation, multi-tenant job fairness,
the data-processor compliance burden (DPA, per-customer GDPR deletion).

Keep exactly one discipline now (nearly free, needed for yourself anyway): **ICP,
user profile, case studies, and voice live as data the engine reads, never
hardcoded in prompts or logic.**

Productization path (on Postgres, per ADR-0001): either add `tenant_id` to the shared
schema with row-level security when you actually sell it, or provision a **schema or
database per tenant** on the same Postgres cluster, which sidesteps row-level isolation
entirely. Either way productizing is "add a login + provision a tenant," not "rewrite
the data layer." The earlier SQLite-file-per-tenant path no longer applies.

## 8. MVP scope

The sequenced build plan for this scope - capabilities, dependencies, and milestones - is in
[docs/roadmap.md](roadmap.md).

In:
- ICP config + user profile (config-as-data)
- Configurable signal sources (contract uniform from day one; adapters land
  incrementally; cheapest first adapters are the person-yielding ones - LinkedIn
  search and X - because they need no expand layer)
- Manual lead entry (add a known person by hand, no signal; ADR-0010) - the prospect
  carries an `origin`; it starts unscored and is scored only on demand (ADR-0019)
- Normalize + expand layer (company -> people)
- Qualifier (the ported 1-5 scorer), run on demand as a re-score; qualification is a derived read over the latest ICP Scoring (ADR-0019)
- Deep enrichment via Apify, optional and user-triggered from the Person workspace (ADR-0007)
- On-demand generation from the Person workspace: a LinkedIn Message (connection-request | DM, ADR-0021) and a Comment on a post (ADR-0018), each a synchronous click writing one row (ADR-0019)
- The unified Queue (anchor view): the sole intake; approval Creates a Person/Company and promotes the advisory score into the person's initial Scoring (no LLM)
- Configurable pipeline: `Person.status` is a FK into a seeded, CRUD-able `pipeline_status` (Cold .. On Hold), set directly by the operator (ADR-0020)
- Assisted action: the workspace surfaces the generated message/comment + research dossier; you post manually on LinkedIn. LinkedIn-first channel.
- Status tracking + outcome logging against scores
- Universal triage inbox: every signal awaits a human approve/dismiss in the one Queue, with an
  advisory type-keyed rubric hint; no per-source bypass (ADR-0013 / ADR-0014 / ADR-0017)
- Person model: Person with `type` (prospect | peer) + `monitored`; Company as a first-class entity
  (ADR-0015 / ADR-0016)
- Engagement motion: monitor people, fetch/scan their posts, a Feed, and AI-drafted comments the human
  posts (ADR-0018)

Deferred:
- Outcome-driven tuning of the precision bar (data accrues now per D7)
- Full content surface (post/carousel) and bidding surface
- Additional channels (email via the `EmailSender` interface, already designed)
- A chat-configured source scanner; the bridge-finding connection graph (who is connected to the ICP);
  a comment -> outcome learning loop (the engagement analog of D7) - all deferred from the
  content-marketing-engagement slice
- All multi-tenant plumbing (section 7)
- Autonomous/automated sending or commenting (never, per D2)

## 9. Open questions

- **C - the background job runtime under Next.js 16. RESOLVED** by ADR-0001: background
  jobs run in-process via pg-boss on managed Postgres, started from `instrumentation.ts`,
  with a `worker_threads` guard for CPU-bound steps and a clean path to a standalone
  worker process later.
- **How external sources plug into the pipeline. RESOLVED** by D4: a normalize-at-the-edge
  connector contract (the source owns auth/paging and returns normalized RawItems; the
  pipeline owns dedup and Signal persistence; one scan job per Source for failure isolation).
  The system-level boundary is drawn in
  [docs/architecture/system-context.md](architecture/system-context.md).
- **The L2 container decomposition (web app, in-process worker, datastore, the on-demand
  headless-browser process). RESOLVED** by the `c4-level2-architecture` change: see
  [docs/architecture/system-design.md](architecture/system-design.md), with ADR-0002
  (headless-browser scraping), ADR-0003 (LLMProvider port), and ADR-0004 (pg-boss facade).
- **The whole-pipeline data model and the C4 L3 component decomposition. RESOLVED** by the
  `c4-level3-and-domain-model` change: the data model (ERD, lifecycle, events) is in
  [docs/architecture/domain-model.md](architecture/domain-model.md) and the component view in
  [docs/architecture/system-design.md](architecture/system-design.md) (Components C4 L3), with
  ADR-0005 (signal -> N prospect fan-out, refines D5) and ADR-0006 (pre-code L3 view as living canon).
- **The intake gate - does a signal auto-create a prospect, or wait for a human? RESOLVED** by the
  `content-marketing-engagement` change: universal triage (ADR-0013) - every signal awaits a human
  approve/dismiss, and the ICP score is advisory at triage, not an auto-gate. The same change settles
  the engagement motion and the Person/Company/Post/Comment model (ADR-0014..0018).
- **The intake surface - one inbox or a split Triage + Review queue? RESOLVED** by the
  `engagement-rework` change: one unified Queue is the sole intake; the separate Review & approve queue
  is removed because the automatic drafting output it reviewed is gone (ADR-0019).
- **The Person status model - a fixed disposition enum or a configurable pipeline? RESOLVED** by the
  `engagement-rework` change: `Person.status` is a FK into a seeded, CRUD-able `pipeline_status`
  vocabulary (the seeded "LinkedIn outreach" default is Cold .. On Hold), superseding the fixed enum
  ([ADR-0020](adr/0020-configurable-pipelines-for-person-status.md)).
- **NC1 - the multi-channel artifact model: a `channel` discriminator on Message/Comment, or
  per-channel tables? OPEN.** v1 ships LinkedIn-only (a Message table + the existing Comment table);
  when X / email / Telegram arrive the choice is left to a later investigation
  ([ADR-0021](adr/0021-linkedin-message-entity.md)).
- Adapter shipping order beyond the first two person-yielding sources.
- When the feedback-loop / eval milestone lands (data accrues from day one regardless).
- Exact "assisted action" UI affordances of the Person workspace - the queue/workspace wireframes under (`src/app/prototype/`); see the [anchor-view wireframes explore note](explore/2026-05-26-anchor-view-wireframes.md).
- Apify cost validation at the real (low) volume; where the self-host vs Apify line
  actually falls per source.
- Legal/PII posture once productized (storing third-party prospect data on behalf of
  customers makes you a data processor).

## Relationship to existing docs

- `cto-practice/notes/decisions/2026-05-09-outreach-tool-development-plan.md` -
  superseded on three points: (1) personal tool -> product for CRM users;
  (2) cold-email-first -> LinkedIn-first with signals as the top of funnel (CSV/
  Crunchbase dropped); (3) the data model gains a signal/raw-item entity (one-to-many
  to leads) and outcome logging against scores. The milestone spine (qualifier,
  enrichment, drafter, eval) still holds.
- `cto-practice/notes/decisions/2026-05-19-wisery-crm-setup-guide.md` - M0 foundation
  (data layer + EmailSender + infra) still valid; the data model needs the additions
  above, and `EmailSender` becomes one channel rather than the primary one.
- `tools/job-monitor` - the working prototype this design ports and cleans up.
