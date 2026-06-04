## Context

ADR-0010 (accepted) decides origin-on-Prospect + nullable `signal_id`; the domain model's "Consumer impact" note lists the footprint the signal-keyed pipeline forces. This change implements that. Current signal-keyed facts (verified by the gate): `qualifySignal(signalId)` loads the signal, keys idempotency on `prospects.signalId`, and creates the prospect itself; the scorer (`scorer.ts`) and drafter (`drafter.ts`) consume a `SignalRow`; `loadActionableProspect` (`load.ts`) throws if the signal is missing; `prospectsWithSignal()` and `listProspects` (`read.ts`) and `listQueue` (`queue/read.ts`) `innerJoin(signals)`; `nameFromPayload(payload, fallback)` is the only identity pluck today.

## Goals / Non-Goals

**Goals:** implement ADR-0010 - the migration, the `PersonIdentity` seam, a prospect-keyed qualify entry, left-joined read-models, the Add-lead form, and the re-qualify recovery - without regressing the discovered-prospect path.

**Non-Goals:** normalize-expand (M2); cross-origin dedup (deferred, ADR-0010); manual entry of companies/content; any change to enrichment/review-queue transition logic beyond reading identity via the seam.

## Decisions

### D1. Migration: additive, one file, CHECK via Drizzle `check()`

`signal_id` -> `DROP NOT NULL` (metadata-only); add `origin text NOT NULL DEFAULT 'signal'`, `name`/`headline`/`company`/`linkedin_url` text nullable; add the per-origin CHECK `(origin <> 'signal' OR signal_id IS NOT NULL) AND (origin <> 'manual' OR (signal_id IS NULL AND name IS NOT NULL))`. Drizzle 0.45 supports `check()` in `pgTable`'s second arg (confirmed by the gate), so declare it there and let `db:generate` emit the SQL. Verify the generated migration is isolated and contains exactly these statements. Existing rows (origin defaults to `signal`, `signal_id` present, `name` null) satisfy the CHECK.

### D2. `PersonIdentity` seam (`src/lib/prospect/identity.ts`)

```
interface PersonIdentity { name: string; headline?: string; company?: string; linkedinUrl?: string }
function personIdentity(prospect: { origin; name; headline; company; linkedinUrl }, signal: SignalRow | null): PersonIdentity
```

For `origin = manual` it reads the prospect columns; for `origin = signal` it reads `signals.payload` (subsuming `nameFromPayload`). This is the single origin branch. The scorer, drafter, and `loadActionableProspect` take a `PersonIdentity` instead of a `SignalRow` (the scorer/drafter currently `JSON.stringify` the payload into the prompt - they instead serialize the `PersonIdentity`, a strict shape, which is also cleaner for the prompt). Keep `prompt_version` bumped where the qualify/draft prompt input shape changes (traceability).

### D3. Two qualify entries, shared core

Keep `qualifySignal(signalId)` for the discovered path (loads signal, creates the prospect, idempotency on `signalId`). Add `qualifyProspect(prospectId)`: loads the prospect (already created by the add-lead action), resolves its `PersonIdentity` (signal or columns), scores via the shared scoring core, and writes the `Scoring` + gate transition; idempotency keyed on `prospectId` (a scoring already exists for this prospect). Extract the shared "score identity -> Scoring + gate" core so the two entries do not duplicate scoring logic (rule of three: this is the second occurrence, so extract now since they must not drift). `enqueueQualify(prospectId)` + a prospect-keyed queue handler.

### D4. Read-models: inner -> left join, identity via seam

`prospectsWithSignal()` and `listProspects`/`getProspectDetail` (`read.ts`) and `listQueue` (`queue/read.ts`): `innerJoin(signals)` -> `leftJoin`. The `innerJoin(sources)` that hangs off the signal also becomes a left join (a manual prospect has no source). Display `name`/`sourceKind` come from the `PersonIdentity` seam and a null-tolerant source (manual -> sourceKind `null` or the literal `"manual"`; choose `"manual"` so the UI has a chip). No per-origin branch in the query beyond the coalesce the seam encapsulates.

### D5. Add-lead + re-qualify (prospect-list UI + actions)

A `'use client'` Add-lead form (name required, optional headline/company/linkedinUrl) posting an `addLeadAction` Server Action: validate with a Zod schema, insert the prospect (`origin = manual`, identity columns, status `new`), then `enqueueQualify(prospectId)` fire-and-forget (ADR-0009 carve-out). A `reQualifyAction(prospectId)` re-enqueues for a manual prospect stuck in `new`. Both unauthenticated by design (D1), matching sibling actions.

## Risks / Trade-offs

- **Regressing the discovered path** -> the signal-keyed `qualifySignal` keeps its exact behavior; the shared scoring core is covered by the existing qualification tests plus new prospect-keyed tests. Run the full qualification/draft/enrich integration suite.
- **Left join changing existing list/queue results** -> for signal-derived prospects the left join returns the same rows as the inner join (the signal always exists), so discovered-prospect output is unchanged; only manual rows are newly included. A test asserts a signal-derived prospect still renders identically.
- **CHECK rejecting a valid insert** -> the add-lead action sets `origin=manual`, `signal_id=null`, `name` non-empty (Zod-required), satisfying the manual arm; a unit/integration test inserts a manual prospect and asserts it persists and a signal-derived insert still works.
- **Identity shape in the prompt changes scoring** -> bump `prompt_version` if the qualify prompt input changes, so scores stay traceable; prefer a `PersonIdentity` serialization that matches the prior payload shape to minimize score drift.

## Migration Plan

`db:generate` the one prospects migration; review it is isolated and exactly D1's statements; `db:migrate`. Additive; existing rows satisfy the CHECK with no backfill. Rollback is a new migration (immutable). Serialize against `linkedin-jobs-source`'s enum migration (do not generate both at once).
