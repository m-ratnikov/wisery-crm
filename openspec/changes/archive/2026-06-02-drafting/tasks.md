## 1. Schema and migration

- [x] 1.1 Add the `draft_status` pg enum (`generated | selected | archived`) and the `drafts` table to `src/lib/db/schema.ts`: uuid PK, `prospect_id` FK -> prospects RESTRICT, `profile_id` FK -> user_profile RESTRICT, `channel` text NOT NULL default `linkedin`, `body` text NOT NULL, `status` draft_status NOT NULL default `selected`, `provider`/`prompt_version`/`model` text NOT NULL, `createdAt()`; index on `prospect_id` (D-A)
- [x] 1.2 `npm run db:generate`; review the migration (table, enum, RESTRICT FKs, index); confirm ordered after the qualification migrations, no new env var; `npm run db:migrate`

## 2. The drafter (LLM port + profile + signal)

- [x] 2.1 Create `src/prompts/draft_v1.ts`: the static first-touch methodology as the prompt `system` text (voice/brevity/mirror-the-prospect/no-pitch), exported as a `Prompt` (`name: "draft"`, `version: "v1"`) (D-F)
- [x] 2.2 Create `src/lib/draft/drafter.ts` (`server-only`): `draftResultSchema` (`{ body }`) and `draftMessage(signal, profile, { llm })` - build messages from the prompt system + profile + signal payload, call `llm.complete(...)`, return `{ body, provider, promptVersion, model }` (D-B)

## 3. The draft pipeline

- [x] 3.1 Create `src/lib/draft/pipeline.ts` (`server-only`) `draftProspect(prospectId, { llm })`: load the prospect; no-op if not `qualified` or it already has a `selected` draft (idempotency, D-C/D-E); load its signal and the active user profile (hard error if no profile) (D-C)
- [x] 3.2 Generate the draft (outside the transaction); then in one Drizzle transaction archive any prior `selected` draft for the prospect, insert the new `selected` `Draft` (body, channel, profile_id, provider/prompt_version/model), and set the prospect `status = queued` (D-C, ADR-0008)

## 4. The draft queue and the enqueue-on-qualify hook

- [x] 4.1 Create `src/lib/draft/draft-queue.ts` (`server-only`): `enqueueDraft(prospectId)` (singletonKey), `enqueueDraftForProspects(ids)` (resilient per-id), `registerDraftWorker()` with `policy: "singleton"` and NO error-swallowing catch (review-remediation patterns) (D-D)
- [x] 4.2 In `src/lib/qualify/pipeline.ts`, add `qualifiedProspectIds: string[]` to `QualifyResult` (the prospects left `qualified`, not below_bar) (D-E)
- [x] 4.3 In `src/lib/qualify/qualify-queue.ts`, give `registerQualifyWorker(opts?: { onProspectsQualified?: (ids: string[]) => Promise<void> })` and call it with the qualified ids after a qualify job (D-E)
- [x] 4.4 In `bootstrapNodeRuntime()`: `registerDraftWorker()` and wire `registerQualifyWorker({ onProspectsQualified: enqueueDraftForProspects })` (D-E); keep the jobs facade generic

## 5. Tests (fake LLM, no network)

- [x] 5.1 Unit-test `draftResultSchema` (valid body passes; missing body fails)
- [x] 5.2 Integration test (gated, fake LLM): drafting a qualified prospect persists a `selected` `Draft` with body + provider + prompt_version + model + profile_id, and moves the prospect to `queued`
- [x] 5.3 Integration test: a below-bar prospect is not drafted (the auto path skips it; `draftProspect` no-ops on a non-qualified prospect)
- [x] 5.4 Integration test: re-running `draftProspect` for an already-drafted prospect does not create a second `selected` draft (auto-draft idempotency); a deliberate re-draft archives the prior selected and selects the new (regenerability)

## 6. Verify, canon, re-review, archive

- [x] 6.1 Update the domain-model `DRAFT` and `SCORING` ERD entities to list `provider` (doc accuracy, D-G)
- [x] 6.2 Cover `src/lib/draft/**` via the tests; exclude only `draft-queue.ts` (boot glue) per the scan/qualify-queue precedent
- [x] 6.3 `npm run verify` green (typecheck, lint, format, depcruise, dup, per-file coverage, build) against a reachable test Postgres
- [x] 6.4 Re-review the fix delta in context per the looping rule, then `/opsx:verify` (conformance to ADR-0007/0008/0003, D5) and archive
