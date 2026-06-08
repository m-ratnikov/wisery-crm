## Why

ADR-0018 (Post entity) and ADR-0015 (the `monitored` facet) are accepted, and the `person-model-foundation` change has landed the `Person` model. This slice adds a person's **posting activity**: fetch their recent posts, watch the people worth engaging, and browse a Feed. It is purely additive - it works on the people who already exist (discovered prospects, manual leads) and adds no change to the outreach pipeline. It is the substrate the comments slice (and the content-signal triage routing) build on.

## What Changes

- **Migration**: `posts` table - `person_id` FK, `external_url`, `dedup_key` (unique per person), `content`, nullable `posted_at`, `fetched_at`, `created_at`. (ADR-0018)
- **`EnrichmentProvider.fetchPosts(person)`**: a new method on the existing port (distinct from deep-profile `enrich`), returning recent posts; implemented by the Apify / self-host browser adapters. `dedup_key` = the provider's stable post/activity id when present, else a canonicalized permalink (query/fragment stripped, host normalized), else the item is dropped (anti-fabrication). Upsert is idempotent on `(person_id, dedup_key)`.
- **fetch-posts handler -> posts core**: a pg-boss handler that fetches and idempotently upserts; serves both the user-triggered and the activity-scan paths.
- **"Get latest posts" action** on the person detail (a user-triggered, cost-bounded enqueue, ADR-0007 pattern) and a **monitored toggle**.
- **activity-scan dispatcher**: a pg-boss cron handler that enqueues **one fetch-posts job per monitored person** (per-unit isolation, D-K), keeping the Feed fresh - never one monolithic job.
- **Feed** (anchor view #4): a Server Component surface listing recent posts from `monitored` people, newest first, filterable by person; opens a post detail (the comment-draft surface lands in the comments slice).

## Capabilities

### New Capabilities

- `engagement-posts`: the CRM user fetches a person's recent posts on demand or via a scheduled activity scan over monitored people, watches people via a `monitored` flag, and browses their posts in a Feed. No content is sent anywhere - this is read-and-store plus a browse surface.

## Impact

- **Migration**: one Drizzle migration adding `posts` (serial journal - author isolated).
- **New code**: `EnrichmentProvider.fetchPosts` on the port + the adapter implementations; a posts core + `fetch-posts` handler under `src/lib/posts/` (or the engagement slice); the activity-scan cron registration at the composition root; the Feed route + the person-detail "get latest posts" / monitored actions.
- **Reuses**: the `EnrichmentProvider` port (D4, a new method, not a new port), the `jobs` facade (ADR-0004) for the handler + cron, the `db` facade, the ADR-0007 user-triggered-enrichment pattern, ADR-0011/0012 jobs-monitor visibility.
- **Governed by**: ADR-0018 (Post), ADR-0015 (monitored), ADR-0007 (user-triggered/cost-bounded), ADR-0001 (in-process worker), D-K (per-unit scan isolation).
- **Unaffected**: the outreach pipeline (qualify/draft/queue), triage (not yet built). Anti-hallucination: a person with thin/no activity returns nothing, never a fabricated post.
