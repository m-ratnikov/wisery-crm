## 1. Migration and schema (prospects)

- [x] 1.1 In `src/lib/db/schema.ts`, on `prospects`: make `signalId` nullable (drop `.notNull()`, keep the FK + RESTRICT); add `origin` (text, notNull, default `'signal'`); add `name`, `headline`, `company`, `linkedinUrl` (text, nullable); add the per-origin CHECK via Drizzle `check()` in the table's second arg: `(origin <> 'signal' OR signal_id IS NOT NULL) AND (origin <> 'manual' OR (signal_id IS NULL AND name IS NOT NULL))`.
- [x] 1.2 `npm run db:generate`; verify the migration is one isolated file containing exactly the `DROP NOT NULL`, the `ADD COLUMN`s, and the `ADD CONSTRAINT ... CHECK` - nothing else. Confirm existing rows (origin defaults to `signal`, signal_id present, name null) satisfy the CHECK.
- [x] 1.3 Add an `origin` Zod enum (`signal | manual`) beside the prospect-status Zod (the text+Zod policy) and a manual-lead input schema (`name` required min 1; headline/company/linkedinUrl optional).

## 2. PersonIdentity seam

- [x] 2.1 Add `src/lib/prospect/identity.ts`: `PersonIdentity` type and `personIdentity(prospect, signal | null)` resolving from the prospect columns (manual) or `signals.payload` (signal), subsuming `nameFromPayload`.
- [x] 2.2 Refactor the scorer (`src/lib/qualify/scorer.ts`) and drafter (`src/lib/draft/drafter.ts`) to take a `PersonIdentity` instead of a `SignalRow`; serialize the strict identity shape into the prompt. Bump `prompt_version` on the qualify and draft prompts if the prompt input shape changes (traceability).
- [x] 2.3 Refactor `loadActionableProspect` (`src/lib/prospect/load.ts`) to resolve `PersonIdentity` with the signal optional (no throw when signal is absent).

## 3. Prospect-keyed qualify entry

- [x] 3.1 Extract the shared "score a PersonIdentity -> write Scoring + gate transition" core from `qualifySignal` (rule of three: second occurrence, extract so the two entries cannot drift).
- [x] 3.2 Add `qualifyProspect(prospectId)`: load the prospect, resolve its `PersonIdentity`, run the shared core; idempotency keyed on `prospectId` (a scoring already exists for this prospect + active rubric -> no-op). Keep `qualifySignal` behavior unchanged (creates the prospect, signal-keyed idempotency).
- [x] 3.3 Add `enqueueQualify(prospectId)` + a prospect-keyed queue handler (`src/lib/qualify/qualify-queue.ts`), registered from the composition root.

## 4. Read-models tolerate no signal

- [x] 4.1 `src/lib/prospect/read.ts` (`prospectsWithSignal`, `listProspects`, `getProspectDetail`) and `src/lib/queue/read.ts` (`listQueue`): `innerJoin(signals)` and the signal-hung `innerJoin(sources)` -> `leftJoin`; resolve display name via the `PersonIdentity` seam; manual `sourceKind` -> `"manual"`. Confirm a signal-derived prospect's output is byte-identical to before.

## 5. Add-lead and re-qualify UI

- [x] 5.1 Add `addLeadAction` (validate with the manual-lead schema; insert prospect origin=manual + identity + status `new`; `enqueueQualify(prospectId)` fire-and-forget) and `reQualifyAction(prospectId)` (re-enqueue for a manual prospect in `new`) to `src/app/(app)/prospect-list/actions.ts`; unauthenticated by design (D1), matching siblings.
- [x] 5.2 Add a `'use client'` Add-lead form (name required, optional fields) and a re-qualify control for an unscored manual prospect, in the prospect-list components.

## 6. Tests and verification

- [x] 6.1 Unit: `personIdentity` resolves from prospect columns (manual) and from payload (signal); the origin/manual-lead Zod schemas (name required).
- [x] 6.2 Unit: the shared scoring core scores a `PersonIdentity`; `qualifyProspect` idempotency keyed on prospectId.
- [x] 6.3 Integration (DB-gated): insert a manual prospect (CHECK passes), qualifyProspect scores it; a signal-derived insert still works and the CHECK rejects an illegal row (origin=signal + null signal_id, and origin=manual + null name).
- [x] 6.4 Integration: `listProspects`/`listQueue` include a manual prospect and a signal-derived prospect appears unchanged (left-join regression guard).
- [x] 6.5 `npm run verify` green (typecheck, lint, format, dependency-cruiser, jscpd, per-file coverage, build).
- [x] 6.6 `code-review` pass on the change surface (loop: re-verify and re-review the fix delta until a pass finds nothing material) before archive.
