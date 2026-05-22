## Actors

- **CRM user (primary operating persona)**: a freelancer, solopreneur, developer, consultant, or other operator who runs outreach for their own book of business (tenant #1). Wants qualified prospects and an optional drafted first touch without wiring five tools together, and wants to act manually to stay within each channel's terms of service.
- **Signal source (external system)**: the upstream origins of raw source records - a person, company, or piece of content, before the system normalizes or dedups it - reached via LinkedIn search, X posts, a CSV of companies, Google Alerts / news, or public job boards / HN / YC. Drives the "one boundary for many source types" requirement.
- **Scraping / enrichment provider (optional, pluggable external system)**: when used, a paid third party (Apify is one example) the system calls to reach authenticated sources and to deep-enrich prospects, behind the D4 interfaces. It is optional - the system can self-host scraping (Puppeteer/Playwright) and use no external provider at all. When one is used it is the main external cost and availability risk (paid per call, can throttle or fail), so the design gates how often it is called and degrades around it.
- **LLM API (external system, Anthropic)**: the system calls it to score prospects (qualification) and to generate drafts. Calls are metered (cost per token) and can rate-limit or fail, so - like the data provider - it is a paid external service the design must budget for and degrade around (e.g. queue, retry, fall back).
- **Prospect (external human actor)**: the person who ultimately receives the human-sent touch, through whatever channel the touch targets (LinkedIn first; other channels later). Two facts about this actor shape the system boundary: their personal data enters the system (a point where third-party PII crosses into our control), and they are reached by a human action, never by automated sending.

## Use cases

### UC1: Configure targeting and sources (CRM user)
- **Main success**: the CRM user defines who to target (the ICP rubric), their own profile, and which signal sources to listen to - all as config-as-data the system persists and the engine reads.

### UC2: Surface qualified prospects from signals (CRM user)
- **Main success**: the system scans the configured signal sources, normalizes and expands records into people, qualifies each 1-5 against the ICP, gates at >= 3, and deep-enriches the survivors into a full prospect record (the dossier).
- **Alternates/exceptions**: for company/content sources the usual order reverses - normally you qualify cheaply first and only enrich the survivors, but here you must expand a company into people (via a provider or self-hosted scraping) *before* you can qualify anyone. To contain that cost the system pre-checks firmographics cheaply and expands only decision-maker roles. A single source scan that fails is recorded in isolation, without affecting other sources.

### UC3: Draft a first touch (CRM user)
- **Main success**: a configurable step - when drafting is enabled, the system generates a personalized first-touch draft from the user's profile, the originating signal, and the enrichment; when disabled, the prospect is surfaced for review without a draft.

### UC4: Review and act on a prospect (CRM user)
- **Main success**: the CRM user reviews the dossier (and the draft, if any) in the approve queue, then acts manually toward the Prospect through the channel the touch targets. The acting surface is extensible - a LinkedIn message, a cold-email draft, an X message, a LinkedIn-comment suggestion, and so on.
- **Alternates/exceptions**: no automated send exists - the only thing that crosses to the Prospect is a human action (ToS-safe, D2).

### UC5: Track outcomes against scores (CRM user)
- **Main success**: the system records the outcome (connected, replied, booked) against the prospect's original score, so the qualification bar can be tuned later.

### UC6: Browse and organize the book (CRM user)
- **Main success**: the CRM user works from a list of prospects and companies - filtering, tagging, and opening a full per-person or per-company dossier - to manage their book of business across the pipeline.
- **Note**: this captures the goal only. The detailed UI (columns, filter facets, the tag model) is a later capability-level spec, and the tag/list entities belong to a domain-model change - not this L1 system-context slice.

## Primary journey

The daily loop. "Anchor view" = one of the few hand-built UI screens the product commits to (everything else is background jobs or generated output), per the product thesis.

1. Configure ICP, profile, and signal sources - anchor view: config (occasional). [UC1]
2. Pull raw source records from the configured sources - background job: signal scan (reads from Signal source actors). [UC2]
3. Normalize and expand company/content records into people - background job (a provider or self-hosted scraping). [UC2]
4. Qualify each prospect 1-5 against the ICP and gate at >= 3 - background job: qualifier (LLM API). [UC2]
5. Deep-enrich the >= 3 prospects into a full dossier - background job (a provider or self-hosted scraping). [UC2]
6. Draft a first touch, if drafting is enabled - background job (LLM API). [UC3]
7. Review the dossier and draft, then act through the chosen channel - anchor view: review/approve queue (high judgment). [UC4]
8. Track the outcome against the original score - background job + tracking. [UC5]

Throughout, the CRM user navigates from the prospect/company list (an anchor view) to filter, tag, and open dossiers (UC6).

## Acceptance signals

- One boundary for many sources (UC2): can a new source type be added without a new pipeline or a new system-level contract? (relates to D4/D8)
- Human-only action (UC4): does the L1 picture show the connection to the Prospect as human-only, with no automated-send arrow crossing the boundary? (ToS-safe quality attribute, D2)
- Data sensitivity visible (UC2/UC4): can you point to every place where third-party PII crosses the boundary - inbound from sources and any scraping/enrichment provider, outbound at the human action - in a single diagram? (privacy quality attribute)
- External-dependency tolerance (UC2/UC3): are the paid, rate-limited externals (the scraping/enrichment provider when used, the LLM API) shown as distinct boundary dependencies, so their cost and degraded availability stay isolated concerns? (cost/availability quality attribute)
