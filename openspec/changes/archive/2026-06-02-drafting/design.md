## Context

Qualification marks prospects `qualified` (Wave 3); the `LLMProvider` port (Wave 1) and the user profile config-as-data (Wave 2) exist. Drafting is the default `Qualified -> Queued` path (ADR-0007, ADR-0008): generate a first-touch message from the profile + signal, persist it, and queue the prospect for human review. It mirrors qualification's shape (port-backed pipeline core + singleton queue worker + a composition-root enqueue hook) and applies the corrected patterns from the review-remediation (singleton policy for idempotency, no error-swallowing worker, `provider` recorded).

## Goals / Non-Goals

**Goals:** the `drafts` table; the drafter (profile + signal -> message via the port, fake-injectable); persist a selected `Draft` and move the prospect to `queued`; auto-draft-on-qualify wired dependency-safely; idempotency + regenerability (re-draft archives the prior selected); provider/prompt/model recorded. **Non-Goals:** enrichment / the dossier read / the richer re-draft (enrichment owns those, ADR-0007); the review-queue UI; sending (D2); drafting below-bar prospects.

## Decisions

### D-A: One table + a closed draft_status enum
`drafts`: `id` uuid, `prospect_id` FK -> prospects RESTRICT, `profile_id` FK -> user_profile RESTRICT, `channel` text (default `linkedin`), `body` text, `status` `draft_status` pg enum (`generated | selected | archived` - a closed, low-churn set, so a pg enum per the domain-model enum policy), `provider`/`prompt_version`/`model` text (eval traceability, ADR-0003 - the same fields scorings records), `created_at` via the shared `createdAt()` helper. Index on `prospect_id`.

### D-B: The drafter calls the port with the profile + signal
`draftResultSchema` = `{ body: string }`. `draftForProspect(prospect, signal, profile, { llm })` reads the active user profile (`getUserProfile`), builds messages from the static draft prompt (the voice/format methodology) + the profile (positioning/offer/voice/case studies) + the signal payload, calls `llm.complete({ prompt: draftPromptV1, messages, schema: draftResultSchema, model, maxTokens })`, and returns the body + provider/model/promptVersion. `llm` defaults to `getLLM()`, injected as the fake in tests.

### D-C: The pipeline persists a selected draft and queues the prospect, in one transaction
`draftProspect(prospectId, { llm })`: load the prospect; if it is not `qualified`, or already has a `selected` draft (auto-draft idempotency, D-E), no-op. Load its signal and the active profile (hard error if no profile - config must be seeded). Generate (outside the transaction - no network in a tx). Then in one Drizzle transaction: archive any prior `selected` draft for the prospect (regenerability, ADR-0007), insert the new `selected` `Draft`, and set the prospect `status = queued` (ADR-0008 disposition). A below-bar prospect is never drafted because the auto path only enqueues qualified ones (D-E) and the guard rejects non-qualified.

### D-D: Singleton queue + propagate errors (the corrected pattern)
`enqueueDraft(prospectId)` sends with `singletonKey: prospectId`; the queue is created with `policy: "singleton"` so at most one active draft job per prospect (review-remediation Q1). `registerDraftWorker` lets handler errors propagate so pg-boss retries transient failures and dead-letters poison (review-remediation S1) - no swallowing catch.

### D-E: Auto-draft-on-qualify wired at the composition root (no qualification -> drafting import)
`qualifySignal` returns the ids of prospects it left `qualified` (`qualifiedProspectIds`); `registerQualifyWorker(opts?: { onProspectsQualified?: (ids) => Promise<void> })` calls the hook after a qualify job. `bootstrapNodeRuntime()` wires `registerQualifyWorker({ onProspectsQualified: enqueueDraftForProspects })` and registers the draft worker. Dependency direction stays drafting -> qualification-free; the wiring lives at the root, the same seam as scan -> qualify. (Third use of this hook shape; still small and per-stage-typed - not abstracted, rule-of-three watch noted.)

### D-F: Prompt versioning
`src/prompts/draft_v1.ts` holds the static first-touch methodology (voice, brevity, mirror-the-prospect, no-pitch - from the profile's `voice` guidance and gtm.md) as the prompt `system` text; the dynamic profile fields and signal go in the user message. `prompt_version` identifies the methodology; the profile is config-as-data referenced by `profile_id`.

### D-G: Canon accuracy - add `provider` to the DRAFT (and SCORING) ERD entities
The domain-model `DRAFT` and `SCORING` entities omit `provider`, but the code records it (ADR-0003 per-provider evals; scorings already has it). This change adds `provider` to those two ERD field lists - a doc-accuracy edit to keep canon honest, not a new decision.

## Risks / Trade-offs

- **No user profile when a draft job runs** -> hard error (the job retries; the config seed is expected to have run), legible like the qualifier's missing-rubric error.
- **Auto-draft idempotency is queue + guard, not a DB unique** -> a prospect can legitimately have many drafts (regenerable), so no unique on `prospect_id`; the singleton policy + the has-selected-draft guard prevent the auto path from double-drafting, the same approach qualification uses (and the partial-unique on one-active is unnecessary because multiple drafts are valid - only one is `selected`).
- **The drafter's network call is not unit-coverable** -> tests use the fake provider; the draft-queue worker is coverage-excluded boot glue like the others.

## Migration Plan

1. Add `drafts` + `draft_status` to `schema.ts`; `db:generate` -> review the next migration; `db:migrate`.
2. Build `src/lib/draft/` (drafter, pipeline, queue) + `src/prompts/draft_v1.ts`.
3. Add `qualifiedProspectIds` to `qualifySignal`'s result + `onProspectsQualified` to the qualify worker; wire `enqueueDraftForProspects` + `registerDraftWorker` in `bootstrapNodeRuntime()`.
4. Update the domain-model `DRAFT`/`SCORING` ERD entities to list `provider`.
5. Integration-test with the fake LLM (draft persisted + selected + queued; below-bar not drafted; idempotent re-run; provider/prompt/model recorded).
6. **Rollback:** drop `drafts` + the enum (nothing references them until review-queue); migrations immutable.

## Open Questions

- Per-call model/maxTokens for drafting (a stronger model than the scorer, since this is the high-value generative step) - pinned in the drafter now, revisit with evals.
- Whether `channel` should be a Zod-validated text set rather than a free text default - kept simple (`linkedin`) for MVP; revisit when a second channel (email) lands.
