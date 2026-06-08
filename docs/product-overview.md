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
  judgment lives: ICP/profile config, the lead list, and the review/approve queue.
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
  Wants qualified prospects and an optional drafted first touch without wiring five tools
  together, and acts manually to stay within each channel's terms of service. Everything
  personal to one CRM user (ICP, profile, case studies, voice) is per-tenant
  config-as-data (D1).
- **Prospect (end recipient)** - the person who ultimately receives the human-sent touch,
  through whatever channel it targets (LinkedIn first). Two facts shape the system boundary:
  their personal data enters the system (third-party PII), and they are reached only by a
  manual human action, never automated sending (D2). The same boundary holds for an **engagement
  target** - a peer or buyer whose post the CRM user comments on: their post data enters the system,
  and the human posts every comment by hand (D2).

## Primary journey

The daily loop. "Anchor view" = one of the few hand-built UI screens the product commits to
(ICP/profile config, lead list, review/approve queue); everything else is background jobs or
generative output (the thesis above). The runtime flows in
[docs/architecture/system-design.md](architecture/system-design.md) and the boundary flow in
[system-context.md](architecture/system-context.md) are dynamic views of this journey and
must stay consistent with it.

1. Configure ICP, profile, and signal sources - anchor view: config (occasional).
2. Pull raw source records from the configured sources - background job: signal scan; an advisory,
   type-keyed rubric scores each new signal by intent.
3. Triage the inbox: approve (route to a Person, a Company, or a peer-author + Post) or dismiss -
   every signal waits, no per-source bypass - anchor view: the Queue triage lane (ADR-0013).
4. Qualify each approved `type = prospect` person 1-5 against the ICP and gate at >= 3 - background
   job: qualifier (LLM provider). The triage score was advisory; the durable per-person Scoring is
   created here, after approval.
5. Optionally deep-enrich a qualified prospect into a full dossier - background job (a
   provider or self-host scraping). **User-triggered and optional by default** (from a
   prospect's detail or a batch grid multi-select), with an opt-in auto-enrich setting;
   not an automatic stage ([ADR-0007](adr/0007-user-triggered-optional-enrichment.md)).
6. Draft a first touch, if drafting is enabled - background job (LLM provider). By default
   drafted from the signal; re-drafted from the dossier when a prospect is enriched.
7. Review the dossier and draft, then act through the chosen channel - anchor view: the Queue's
   send lane (high judgment).
8. Track the outcome against the original score - background job + tracking.

Alongside the outreach loop, the **engagement motion**: flag a person `monitored`, fetch or scan their
recent posts into the **Feed** (anchor view), open a post, generate an AI comment grounded in the
person's info and the global comment guidance, edit it, and post it manually - the human posts every
comment (D2). Peers are tracked and scored against the peer rubric for engagement, not run through the
draft/send funnel (ADR-0015 / ADR-0017 / ADR-0018).

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
| D5 | Qualifier = port of `job-monitor`'s static 1-5 ICP scorer (alert at >= 3, platform-aware, structured output, anti-hallucination). Qualify uses the cheap signal as the cost gate; the first-touch draft is a **separate** LLM call after deep enrichment, grounded in the dossier (per the pipeline order). Refined by ADR-0005: the score is recorded per person (a Scoring against the prospect), not on the shared signal (ADR-0005 now superseded by ADR-0010, which keeps the per-person score and fan-out and adds the manual origin). Refined by ADR-0007: the draft is from the signal by default and enrichment is optional/user-triggered (re-drafting from the dossier), not an automatic pre-draft stage. Further refined by ADR-0013: under universal triage the score is demoted from an auto-gate to an advisory hint shown at triage; the durable per-person Scoring is still created after approval, by the qualify job. | Proven, cheap scorer, already written (M2). Splitting the draft out of job-monitor's bundled call is the one evolution. Ordering resolved at the C4 L2 review, 2026-05-24; enrichment made optional/user-triggered by ADR-0007 (2026-06-01); manual-origin prospects added by ADR-0010 (2026-06-04). |
| D6 | The ICP rubric becomes config-as-data, not a hardcoded prompt. | Required for reuse by other CRM users and for the config UI. |
| D7 | Log outcomes against scores from day one; outcome-driven tuning of the bar is a later additive milestone. | Lets the feedback loop become additive, not a migration. The learning loop is the "neo" differentiator. |
| D8 | Entry point is configurable: multiple source types (LinkedIn search, CSV of companies, Google alerts, X posts, ...). | Already proven across 11 platforms in `job-monitor`. A new source is a new adapter, not a new pipeline. |
| D9 | LLM access is provider-agnostic behind an `LLMProvider` port: a provider-neutral structured-output contract (JSON Schema + Zod), with Anthropic as the default adapter, not a binding. | Avoid single-vendor lock-in on the highest-value path (qualify + draft); the contract is provider-neutral anyway. (ADR-0003) |
| D10 | PII field minimization and sub-processor controls attach at the qualify boundary; earlier pipeline stages do not constrain data shape. Provisional, deferred until productization. | Single designated seam for data-processor controls when productized; avoids scattering minimization across adapters. (D1; system-design cross-cutting) |
| D11 | Universal triage is the intake gate: every signal awaits a human approve/dismiss before any entity is created; no per-source bypass. The ICP score is advisory at triage, not an auto-gate. | Keeps the human in control of what enters the CRM as broad/noisy sources and peers (not just buyers) join the funnel; reworks the shipped auto-fan-out-then-auto-gate intake. ([ADR-0013](adr/0013-universal-triage-intake.md), refining ADR-0005's fan-out trigger; with ADR-0014..0018 for the engagement motion.) |

## 4. Pipeline architecture

```
  [ configurable source adapters ]  ── raw items (person | company | content)
                 │
                 ▼
  SIGNALS (deduped, immutable) ──► ADVISORY FILTER (type-keyed rubric: icp | peer | company; advisory hint only)
                 │
                 ▼
  TRIAGE  [ HUMAN INBOX = Queue triage lane ]  approve / dismiss
   every signal waits, no per-source bypass (ADR-0013)
                 │ approve routes by signal kind:
                 │   company ─► COMPANY
                 │   content ─► PERSON(type = peer) + POST ─┐
                 │   person  ─► PERSON(type = prospect)     │
                 ▼                                          ▼
  QUALIFY (1-5 ICP scorer) ─► >= 3 ─► DRAFT ─► [ SEND     ENGAGEMENT MOTION
   per-person Scoring          │      touch    QUEUE ]      monitor ─► fetch / scan POSTS ─► FEED
   (after approval, D5)        │               anchor        ─► AI COMMENT ─► you post it (manual, D2)
                 │             └─► DEEP ENRICH ─┘ view
                 ▼               (optional; re-drafts from the dossier)
   you act (manual, ToS-safe) ─► TRACK + measure outcomes vs the score (D7)
```

Under universal triage every signal lands in the inbox; an advisory, type-keyed rubric hint helps the
human decide, but never auto-gates (ADR-0013/0017). Approval routes by kind to a Person, a Company, or
a peer-author + Post; only a `type = prospect` person enters the qualify -> draft -> send funnel. Deep
enrichment stays **optional and user-triggered by default**, re-drafting from the dossier
([ADR-0007](adr/0007-user-triggered-optional-enrichment.md), refining D5). The engagement motion runs
alongside: monitor a person, fetch or scan their posts into a Feed, generate an AI comment, and post it
by hand ([ADR-0018](adr/0018-engagement-artifacts-post-comment.md), D2).

Anchor views (the only hand-built UI): **ICP/profile config, lead list, the Queue (triage + send
lanes), and the Feed.** Everything else is jobs + generative output.

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
**Scoring** (the per-person ICP/peer rating), **Post** and **Comment** (the engagement artifacts - a
person's content and the AI-drafted, human-posted reply), **Comment guidance** (global comment config).
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
- In job-monitor, qualify and the first-touch draft were one call; this change splits them (see Upgrade).

Upgrade three things:
- Move the rubric out of a hardcoded prompt into ICP config-as-data (D6).
- Persist outcomes (connected? replied? booked?) against each score (D7).
- Split qualify and the first-touch draft: qualify scores on the signal as the cost gate; the draft becomes a separate call after deep enrichment, grounded in the dossier, not bundled into the score call (D5, pipeline order).

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
  carries an `origin` and flows through the same qualify gate as a discovered one
- Normalize + expand layer (company -> people)
- Qualifier (the ported 1-5 scorer)
- Deep enrichment via Apify, optional and user-triggered by default with opt-in auto (ADR-0007)
- Personalized draft from profile + signal context
- Review/approve queue (anchor view)
- Assisted action: queue hands you the drafted touch + research dossier + a deep link;
  you act manually on LinkedIn. LinkedIn-first channel.
- Status tracking + outcome logging against scores
- Universal triage inbox: every signal awaits a human approve/dismiss (the Queue triage lane), with an
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
- Adapter shipping order beyond the first two person-yielding sources.
- When the feedback-loop / eval milestone lands (data accrues from day one regardless).
- Exact "assisted action" UI affordances - being explored via the review/approve queue wireframe (`src/app/prototype/review-queue`); see the [anchor-view wireframes explore note](explore/2026-05-26-anchor-view-wireframes.md).
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
