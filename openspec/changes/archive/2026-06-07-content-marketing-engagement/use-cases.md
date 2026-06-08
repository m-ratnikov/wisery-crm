## Actors

- **CRM user** (primary operating persona): a freelancer, solopreneur, developer, consultant, or fractional CXO running their own outreach. Wants to grow warm relationships by engaging the right people's content, and to control what enters their CRM rather than have a noisy pipeline auto-fill it.
- **Signal source** (external): a configured origin the connectors pull from - LinkedIn search, X, Google/web search, job boards. Surfaces people, companies, and standalone content.
- **Scraping / enrichment provider** (external, optional): Apify or a self-host browser, behind the `EnrichmentProvider` port - fetches a person's recent posts and deep profile on demand (D4, ADR-0002).
- **LLM provider** (external): behind the `LLMProvider` port - produces the advisory ICP/peer score and the drafted comment (D9, ADR-0003).
- **Engagement target** (external recipient): the ICP buyer or the peer/amplifier whose post the CRM user comments on. Reached only by a manual human action (D2) - the CRM user posts every comment by hand.

## Use cases

### UC1: Triage the signal inbox (CRM user)
- **Main success**: The CRM user opens the Queue, sees pending signals (people, companies, standalone content) each annotated with an advisory filter result (ICP score, peer-fit, or company-fit), and approves or dismisses each. Approval routes by signal kind to create the right entity; dismissal is recorded so the item does not resurface.
- **Alternates/exceptions**: A dismissed signal re-surfaced by a later scan (same dedup key) stays dismissed - the decision must survive re-scans (forces the `signal_decisions` table, separate from the immutable signal).

### UC2: Approve a discovery into the right entity (CRM user)
- **Main success**: Approving a person signal creates a `Person`; a company signal creates a `Company`; a standalone-content signal creates the post's author as `Person(type = peer)` with the `Post` attached. The CRM user may set the `monitored` flag at approval.
- **Alternates/exceptions**: A person can be both an outreach target and monitored - `type` and `monitored` are independent facets on one identity, not separate rows.

### UC3: Configure a monitoring source (CRM user)
- **Main success**: The CRM user adds or edits a `Source` (kind + config-as-data) for the people, companies, and content to watch. Every source feeds the triage inbox uniformly - there is no per-source auto-create bypass.
- **Alternates/exceptions**: omit.

### UC4: Fetch a person's recent posts on demand (CRM user)
- **Main success**: From a person's detail page the CRM user clicks "get latest posts"; a user-triggered job fetches recent activity via the provider and stores `Post` rows, shown on the card. No signal is required.
- **Alternates/exceptions**: Thin or unavailable activity returns nothing rather than a fabricated post (anti-hallucination, consistent with the qualifier's insufficient-data stance).

### UC5: Browse the engagement feed (CRM user)
- **Main success**: The CRM user opens the Feed and sees recent `Post`s from `monitored` people (kept fresh by an activity scan), newest first, filterable by person.
- **Alternates/exceptions**: omit.

### UC6: Draft and post a comment (CRM user)
- **Main success**: On a feed post the CRM user opens the detail (full post + everything known about the person), generates an AI comment grounded in the person's info and the global comment guidance, edits it, copies it, posts it manually on the channel, and marks it posted.
- **Alternates/exceptions**: The comment is never auto-posted - the human always posts (D2). Regenerating produces a new `Comment`; many comments accrue per person (one per post).

## Primary journey

The engagement daily loop, alongside the existing outreach loop (which continues unchanged after a prospect is approved):

1. Configure monitoring sources - anchor view: config (occasional).
2. Scans surface diverse signals; an advisory filter scores each by type - background job: scan + advisory filter.
3. Triage the inbox: approve (route to person / company / author-as-peer + post) or dismiss - anchor view: Queue (kind = triage).
4. Flag the people worth engaging as `monitored`; optionally fetch their latest posts from the detail page - anchor view: person detail; background job: fetch-posts.
5. An activity scan keeps monitored people's posts fresh - background job: activity scan.
6. Browse the Feed, open a post, generate a comment, edit, post manually, mark posted - anchor view: Feed; synchronous server action: comment generation.
7. (Outreach loop, unchanged) An approved `type = prospect` person flows through qualify -> draft -> the Send lane of the Queue -> manual send -> outcome.

## Acceptance signals

- UC1: Can the design present pending signals with an advisory score and record an approve/dismiss decision without mutating the immutable signal? (signal_decisions, D-C preserved)
- UC1 (re-scan): Does a dismissed signal stay dismissed after a later scan re-encounters the same dedup key? (the durability quality attribute)
- UC2: Does approval route by `signal.kind` to the right entity graph (a single primary entity per decision - a content approval creates the author `Person` plus its `Post`, recorded with the `Person` as the primary), and can one person carry both `type = prospect` and `monitored`?
- UC3: Does every configured source feed the same triage inbox, with no per-source path that auto-creates entities and skips the human gate?
- UC4: Is post fetch user-triggered and cost-bounded (never an automatic per-signal stage), reusing the on-demand enrichment pattern (ADR-0007)?
- UC6: Is every comment human-posted (no auto-publish path crosses the boundary, D2), and grounded in the person's info + global guidance via the `LLMProvider` port (D9)?
- Security/privacy: Do posts and comments (third-party PII) stay server-side behind the same boundary as dossiers, with no secret-bearing path to the client?
