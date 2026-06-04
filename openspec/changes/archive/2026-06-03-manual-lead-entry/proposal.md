## Why

ADR-0010 is accepted canon: a Prospect may originate `signal` (discovered) or `manual` (entered by the CRM user). This change implements it - the migration, the Add-lead form, and the pipeline re-key the architecture gate showed is required, because the pipeline is signal-keyed end to end. It lets a CRM user put a known person (a referral, an event contact) under evaluation by hand and have it scored and worked exactly like a discovered prospect.

## What Changes

- **Migration (additive)**: `prospects.signal_id` becomes nullable; add `origin` (text, default `signal`), manual identity columns (`name`, `headline`, `company`, `linkedin_url`, nullable), and the per-origin CHECK `(origin <> 'signal' OR signal_id IS NOT NULL) AND (origin <> 'manual' OR (signal_id IS NULL AND name IS NOT NULL))`. **BREAKING** at the data layer only in that `signal_id` is no longer NOT NULL; existing rows are untouched (default `origin = signal`).
- **`PersonIdentity` read seam**: one resolver returning a prospect's person identity from `signals.payload` (signal origin) or the prospect columns (manual), replacing the direct `SignalRow` dependency in the scorer, the drafter, and `loadActionableProspect`.
- **Prospect-keyed qualify entry**: `qualifyProspect(prospectId)` + `enqueueQualify(prospectId)` with `prospectId` idempotency, alongside the existing signal-keyed `qualifySignal` (which still creates+scores a signal-derived prospect). A manual add inserts the prospect then enqueues this fire-and-forget (ADR-0009 user-triggered carve-out).
- **Read-models left-join**: the prospect-list and queue read-models change `innerJoin(signals)` to `leftJoin`, so a manual prospect (no signal) is not dropped; the `PersonIdentity` seam supplies its display fields.
- **Add-lead form** on the prospect list (a Server Action) and a **re-qualify action** so a manual prospect whose fire-and-forget enqueue failed (it sits in `new`) can be re-driven.

## Capabilities

### New Capabilities
- `manual-lead-entry`: the CRM user adds a person to the pipeline by hand (origin = manual, no signal); the prospect is persisted with its entered identity and enqueued for qualification, then flows through the pipeline like any prospect. Includes the re-qualify recovery for a failed enqueue.

### Modified Capabilities
- `qualification`: qualification scores a prospect by its person identity read through the `PersonIdentity` seam regardless of origin, via a prospect-keyed entry; the existing signal-keyed entry (which creates the prospect for a discovered person) is unchanged in behavior. Idempotency is keyed appropriately for each entry.
- `prospect-list`: a manual-origin prospect appears in the list (and the queue) with the same identity/score/status fields as a discovered one; the list gains an add-lead affordance and a re-qualify affordance.

## Impact

- **Migration**: one Drizzle migration on `prospects` (nullable FK via `DROP NOT NULL`, new columns, the CHECK). Authored isolated; must not be generated concurrently with `linkedin-jobs-source`'s enum migration (serial journal).
- **New code**: `PersonIdentity` type + resolver (likely `src/lib/prospect/identity.ts`); `qualifyProspect`/`enqueueQualify(prospectId)` in the qualify module; the Add-lead + re-qualify Server Actions and form under `src/app/(app)/prospect-list/`; a manual-lead Zod input schema.
- **Modified code**: `src/lib/db/schema.ts` (prospects); `src/lib/qualify/pipeline.ts` + `scorer.ts` (consume `PersonIdentity`, prospect-keyed entry, prospect-keyed idempotency); `src/lib/draft/drafter.ts` + `src/lib/prospect/load.ts` (consume `PersonIdentity`, tolerate no signal); `src/lib/prospect/read.ts` + `src/lib/queue/read.ts` (inner -> left join, identity via seam); `src/lib/signals/scan-queue.ts` + `runScan` already route by kind only after `linkedin-jobs-source` - here the signal-keyed path is unchanged.
- **Governed by**: ADR-0010 (accepted), ADR-0009 (fire-and-forget for the user-triggered enqueue), ADR-0008 (origin is orthogonal to status). Domain model already revised.
- **Unaffected**: the `/prototype` tree, enrichment core, review-queue transitions (they operate on prospects, origin-agnostic once identity is via the seam).
