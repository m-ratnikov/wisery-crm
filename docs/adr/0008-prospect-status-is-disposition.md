# ADR-0008: Prospect.status is a disposition; enrichment and drafting are derived from relations

- Status: accepted
- Date: 2026-06-02
- Refines: ADR-0005 (signal-to-prospect fan-out), ADR-0007 (user-triggered optional enrichment)
- Supersedes: none
- Source: openspec/changes/archive/2026-06-02-prospect-status-model

## Context

The Prospect lifecycle was modeled with a single `status` text field whose vocabulary mixed three categories: scoring disposition (`new`, `scored`, `below_bar`, `qualified`), *artifacts produced* (`enriched`, `drafted`), and human-facing disposition (`queued`, `acted`, `dismissed`, `closed`). The artifact values are the problem. Whether a prospect is enriched or drafted is already represented by the `PROSPECT ||--o| DOSSIER` and `PROSPECT ||--o{ DRAFT` relations, so encoding them as `status` too is a second, divergeable source of truth. Worse, ADR-0007 made enrichment optional and repeatable (draft from the signal, then enrich, then re-draft), so a prospect can be drafted *and* enriched, and can cycle - which a single linear `status` cannot express. The mix surfaced while reviewing the lifecycle after ADR-0007 and is cheapest to fix now: only `new/scored/below_bar/qualified` exist in code, and the capabilities that would otherwise encode `enriched`/`drafted` as statuses (drafting, enrichment, review-queue) are not yet built.

## Decision

`Prospect.status` is exactly one category: the prospect's **disposition in the human-facing pipeline**, a mutually-exclusive set of seven values - `new`, `below_bar`, `qualified`, `queued`, `acted`, `dismissed`, `closed`.

- **"Enriched" and "drafted" are derived facts, not statuses:** enriched == a `Dossier` exists; drafted == a selected `Draft` exists. They are orthogonal to disposition and to each other, and may recur; the related rows are the single source of truth.
- **`scored` is removed:** scoring and gating are one step (`New -> qualified | below_bar` directly), so there is no resting scored-but-ungated state.
- **`new` is kept:** the appeared-but-unscored state - transient for person sources (which score on create) but load-bearing once company/content fan-out (normalize-expand) creates prospects before scoring them.
- Drafting and enrichment are side-activities that produce artifacts and may move disposition (drafting a qualified prospect creates a `Draft` and moves it to `queued`), but enriching/re-drafting a `qualified` or `queued` prospect does not change its disposition.

## Consequences

Easier: one source of truth for "is it enriched/drafted" (the relation), so status and relations cannot disagree; the lifecycle is a clean line again, and ADR-0007's optional/repeatable enrichment fits without status gymnastics; a query for "qualified prospects that already have a draft" is a join, not a status overload. Harder: reads that want "enriched" or "drafted" must check the relation (a join), not a column - acceptable, and correct. Rules out: representing artifact existence via `status`; the drafting/enrichment/review-queue capabilities MUST set only disposition values and derive enriched/drafted from `DOSSIER`/`DRAFT`. Code conformance: `src/lib/qualify/status.ts` drops `scored` from its Zod enum (never set today); the domain-model lifecycle, `PROSPECT.status` vocabulary, and events table are revised to match. This refines ADR-0005/ADR-0007 by fixing the entity-state model those decisions assumed.
