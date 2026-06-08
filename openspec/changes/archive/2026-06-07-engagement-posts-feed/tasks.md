## 1. Posts schema

- [x] 1.1 Add the `posts` table to `src/lib/db/schema.ts`: uuid PK, `personId` FK (RESTRICT), `externalUrl`, `dedupKey`, `content`, nullable `postedAt`, `fetchedAt`, `createdAt`; a UNIQUE index on `(personId, dedupKey)`. `npm run db:generate`; confirm one additive migration.

## 2. fetchPosts port method + adapters

- [x] 2.1 Add `fetchPosts(person): Promise<RawPost[]>` to the `EnrichmentProvider` port; define the `RawPost` shape and the `dedup_key` derivation helper (provider id -> canonicalized permalink -> drop) with unit-tested canonicalization.
- [x] 2.2 Implement `fetchPosts` in the Apify and self-host browser adapters (per the D4 cost knob); a fixture adapter for test/dev.

## 3. fetch-posts handler + posts core

- [x] 3.1 Add a posts core (`src/lib/posts/`): `fetchAndStore(personId)` resolves the adapter, calls `fetchPosts`, derives `dedup_key`, idempotent-upserts on `(personId, dedupKey)`; drops items with no stable id. db-only core.
- [x] 3.2 Add the `fetch-posts` pg-boss handler -> posts core; register it at the composition root.

## 4. Person-detail actions

- [x] 4.1 "Get latest posts" server action: enqueue `fetch-posts(personId)` fire-and-forget (ADR-0009 carve-out); show the stored posts on the person detail.
- [x] 4.2 Monitored toggle server action: set `person.monitored`.

## 5. Activity scan dispatcher

- [x] 5.1 Register a pg-boss cron (`boss.schedule`) whose handler enqueues one `fetch-posts` job per `monitored` person (per-unit isolation, D-K) - never a single loop over people.

## 6. Feed surface

- [x] 6.1 Add the Feed route (Server Component, anchor view #4): recent `posts` from `monitored` people, newest first, filterable by person; opens a post detail (read-only here; the comment-draft UI lands in the comments slice).
- [x] 6.2 Update the prototype registry (`src/app/prototype/README.md`) join table for the Feed + the person-detail posts surface.

## 7. Verification

- [x] 7.1 Unit: `dedup_key` derivation (provider id, permalink canonicalization, drop-on-missing); idempotent upsert (re-fetch produces no duplicates); the activity-scan dispatcher enqueues one job per monitored person.
- [x] 7.2 `npm run verify` green; `code-review` pass on the diff, then re-run `verify` on the fix delta before archive.
