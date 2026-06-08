## Context

The `person-model-foundation` change has landed `Person` + the `monitored` facet. This slice adds the posts substrate and its surfaces. It reuses the existing scraping/enrichment seam (D4, ADR-0002) rather than adding a provider, and the user-triggered/cost-bounded enrichment pattern (ADR-0007) rather than an automatic stage.

## Goals / Non-Goals

**Goals:** the `posts` table; `EnrichmentProvider.fetchPosts` + adapters; the fetch-posts handler; the "get latest posts" and monitored actions; the activity-scan dispatcher; the Feed surface.

**Non-Goals:** comment generation (next slice - the post detail's comment-draft UI lands there); universal triage (the content-signal -> Post routing is the triage slice, which reuses this slice's posts core); company-to-people expansion.

## Decisions

### D1. `fetchPosts` is a new method on the existing EnrichmentProvider port

Fetching a post timeline is a different capability from deep-profile `enrich(subject)`, but it is the same seam (D4) - so it is a new method on `EnrichmentProvider`, not a new port. Adapters that can fetch a timeline implement it; the cost knob (self-host vs Apify) is per the existing D4 selection. No new external system, no new port abstraction (ADR-0018).

### D2. `dedup_key` derivation makes the upsert idempotent against real scrape shapes

`dedup_key` = provider stable post/activity id when present; else a canonicalized permalink (strip query + fragment, normalize host, extract the activity id); else drop the item (the same anti-fabrication stance the qualifier takes on thin data). This is what makes `(person_id, dedup_key)` upsert idempotent across re-fetches and the activity scan, so a retry or re-scan never duplicates a Feed entry (ADR-0018).

### D3. The activity scan is a fan-out dispatcher, not a monolithic job

`boss.schedule(...)` fires one cron job; that job is a thin dispatcher that enqueues one `fetch-posts` job per monitored person, reusing the same handler as the user-triggered path. This restores the per-source/per-unit isolation discipline (D-K): one person's provider failure dead-letters alone and is retried alone, not failing the whole scan. The fetch-posts handler is idempotent (D2), so a re-run is safe.

### D4. The person card and Feed are Server Components; actions are server actions

"Get latest posts" and the monitored toggle are user-triggered server actions enqueuing the fetch-posts job (fire-and-forget, ADR-0009 carve-out - a failed enqueue surfaces to the user who clicks again). The Feed is a Server Component reading `posts` for `monitored` people through the `db` facade. No secret-bearing path reaches the client (ADR-0001 peel-safety).
