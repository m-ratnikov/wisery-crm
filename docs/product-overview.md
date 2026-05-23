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

## 3. Locked decisions

| # | Decision | Why |
|---|----------|-----|
| D1 | Product for CRM users, built single-user. Defer auth, billing, tenant isolation. | The expensive multi-tenant plumbing is additive. Only discipline kept now: config-as-data. |
| D2 | Automate intelligence; the LinkedIn action stays human-assisted. | The old stack's failure and ban risk were entirely in the action layer. ToS-safe, GTM-aligned. |
| D3 | Signals are the top of funnel, not CSV. | Crunchbase ($100/mo) is gone. Signal listening also fuels the comment-first motion. |
| D4 | All scraping/enrichment behind one `SignalSource` / `EnrichmentProvider` interface. Self-host Puppeteer/Playwright for cheap/public sources, Apify for authenticated/deep. | A port of `job-monitor`'s `ScraperBase`. Per-source cost knob; Apify keeps detection risk off the user's own account. |
| D5 | Qualifier = port of `job-monitor`'s static 1-5 ICP scorer (alert at >= 3, platform-aware, structured output, anti-hallucination, qualify + first-touch draft in one call). | Proven, cheap, already written. It is milestone M2 in working form. |
| D6 | The ICP rubric becomes config-as-data, not a hardcoded prompt. | Required for reuse by other CRM users and for the config UI. |
| D7 | Log outcomes against scores from day one; outcome-driven tuning of the bar is a later additive milestone. | Lets the feedback loop become additive, not a migration. The learning loop is the "neo" differentiator. |
| D8 | Entry point is configurable: multiple source types (LinkedIn search, CSV of companies, Google alerts, X posts, ...). | Already proven across 11 platforms in `job-monitor`. A new source is a new adapter, not a new pipeline. |
| D9 | LLM access is provider-agnostic behind an `LLMProvider` port: a provider-neutral structured-output contract (JSON Schema + Zod), with Anthropic as the default adapter, not a binding. | Avoid single-vendor lock-in on the highest-value path (qualify + draft); the contract is provider-neutral anyway. (ADR-0003) |
| D10 | PII field minimization and sub-processor controls attach at the qualify boundary; earlier pipeline stages do not constrain data shape. Provisional, deferred until productization. | Single designated seam for data-processor controls when productized; avoids scattering minimization across adapters. (D1; system-design cross-cutting) |

## 4. Pipeline architecture

```
  [ configurable source adapters ]  ── raw items (person | company | content)
                 │
                 ▼
  NORMALIZE + EXPAND            person passes through;
                               company/content expand to people (Apify)
                 │
                 ▼
  QUALIFY  (1-5 ICP scorer) ──► >= 3 ─► DEEP ENRICH ─► DRAFT touch ─► [ HUMAN QUEUE ] ─► you act ─► TRACK + measure
   the cost gate                 (Apify,         (profile config   anchor view,        manual,        outcomes logged
   and noise cut                  per prospect)   + signal ctx)     high-judgment       ToS-safe       against the score (D7)
```

Anchor views (the only hand-built UI): **ICP/profile config, lead list, review/approve
queue.** Everything else is jobs + generative output.

The system-level boundary view - the system as one box, its actors, and the external
systems it depends on - is in [docs/architecture/system-context.md](architecture/system-context.md).

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
out to N person leads (one-to-many). Model that from the start.

Canonical nouns: **Source** (configured origin, config-as-data), **Connector** (module that
fetches and normalizes one source type), **RawItem** (normalized, un-deduped), **Signal**
(deduped, persisted). The connector boundary - how a source plugs in - is the single,
pluggable interface of D4; its system-level view is in
[docs/architecture/system-context.md](architecture/system-context.md). (A per-area domain
model for these entities is not yet promoted.)

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
- Qualify + first-touch draft in the same call for people at >= 3.

Upgrade two things:
- Move the rubric out of a hardcoded prompt into ICP config-as-data (D6).
- Persist outcomes (connected? replied? booked?) against each score (D7).

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

In:
- ICP config + user profile (config-as-data)
- Configurable signal sources (contract uniform from day one; adapters land
  incrementally; cheapest first adapters are the person-yielding ones - LinkedIn
  search and X - because they need no expand layer)
- Normalize + expand layer (company -> people)
- Qualifier (the ported 1-5 scorer)
- Deep enrichment via Apify (gated by the qualifier)
- Personalized draft from profile + signal context
- Review/approve queue (anchor view)
- Assisted action: queue hands you the drafted touch + research dossier + a deep link;
  you act manually on LinkedIn. LinkedIn-first channel.
- Status tracking + outcome logging against scores

Deferred:
- Outcome-driven tuning of the precision bar (data accrues now per D7)
- Full content surface (post/carousel) and bidding surface
- Additional channels (email via the `EmailSender` interface, already designed)
- All multi-tenant plumbing (section 7)
- Autonomous/automated sending (never, per D2)

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
- Adapter shipping order beyond the first two person-yielding sources.
- When the feedback-loop / eval milestone lands (data accrues from day one regardless).
- Exact "assisted action" UI affordances.
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
