## Actors

- **CRM user** (primary operating persona): a freelancer, solopreneur, developer, or consultant running outreach for their own book of business. Wants qualified, well-researched prospects surfaced with a drafted first touch, and wants to act manually and learn from outcomes. <!-- v:derives docs/product-overview.md section 1 -->
- **Signal source** (external): an upstream origin of people, companies, or content (LinkedIn search, X, CSV, news). Drives ingestion; pulled through the D4 connector contract. <!-- v:derives D8 -->
- **Scraping / enrichment provider** (external, optional): expands companies to people and deep-enriches a prospect; selected per the D4 cost knob. <!-- v:derives D4 -->
- **LLM provider** (external): scores signals against the ICP rubric and drafts the first touch; provider-agnostic behind the D9 port. <!-- v:derives D9 -->
- **Prospect** (end recipient, off-system): the person the CRM user ultimately contacts. The system never contacts them directly (ToS-safe, D2). <!-- v:derives D2 -->

## Use cases

### UC1: Configure the ICP, profile, and sources (CRM user)
- **Main success**: the CRM user saves their ICP rubric, profile, and one or more signal sources as durable config-as-data; sources survive restart and are retrievable. <!-- v:derives D6 -->
- **Alternates/exceptions**: a source is retired by disabling it, never deleted, so its scan and signal history is preserved. <!-- v:derives openspec/changes/signal-ingestion/specs/signal-ingestion/spec.md -->

### UC2: Discover and qualify prospects from signals (CRM user, via the background pipeline)
- **Main success**: a scan pulls a source, normalizes and dedups items into immutable signals, the qualifier scores each signal-derived person against the rubric, and people scoring at or above the bar become prospects. <!-- v:derives docs/product-overview.md section 4 -->
- **Alternates/exceptions**: a company or content signal fans out to many person prospects (one-to-many); below-bar prospects are retained silently for the learning loop, not surfaced. <!-- v:derives docs/product-overview.md section 4 -->

### UC3: Review, approve, and act on a queued prospect (CRM user)
- **Main success**: the CRM user opens the approve queue, reviews a qualified prospect with its dossier and drafted first touch, and acts manually via the chosen channel. <!-- v:derives docs/product-overview.md section 8 -->
- **Alternates/exceptions**: the user dismisses a prospect from the queue without acting. <!-- v:decision -->

### UC4: Log and learn from outcomes (CRM user)
- **Main success**: after acting, the CRM user logs the outcome (connected, replied, booked) against the prospect's score, accruing the data the precision bar is later tuned on. <!-- v:derives D7 -->

## Primary journey

The daily loop, stringing the use cases together. The anchor view or background job at each step is noted. <!-- v:derives docs/architecture/system-design.md -->

1. Configure ICP, profile, and sources - **ICP/source config anchor view** (UC1).
2. A scan runs per source, persisting deduped signals - **scan job** (UC2).
3. The qualifier scores signals and fans out people to prospects, gating at the bar - **qualify job** (UC2).
4. Qualified prospects are deep-enriched into a dossier (optional in M1) - **enrich job** (UC2/UC3).
5. A first-touch draft is generated from the dossier and profile - **draft job** (UC3).
6. The prospect, dossier, and draft are surfaced for review - **approve queue anchor view** (UC3).
7. The CRM user acts manually via the channel, outside the system - **(no system edge, D2)** (UC3).
8. The CRM user logs the outcome against the score - **approve queue anchor view** (UC4).

## Acceptance signals

- UC1: can a saved source and its config be retrieved unchanged after a process restart, and does disabling preserve history? <!-- v:derives openspec/changes/signal-ingestion/specs/signal-ingestion/spec.md -->
- UC2: does re-scanning a source create no duplicate signals, and does one company signal yield N distinct person prospects? <!-- v:derives openspec/changes/signal-ingestion/design.md (D-B) -->
- UC2: does a below-bar score still persist (for D7) while staying out of the queue? <!-- v:derives D7 -->
- UC3: from a queued item, are the source, scan, signal, score, dossier, and draft all resolvable for the human's judgment? <!-- v:derives docs/product-overview.md section 8 -->
- UC4: is each outcome bound to the score and rubric version it acted on, so the bar is tunable later without rewriting history? <!-- v:derives D7 -->
