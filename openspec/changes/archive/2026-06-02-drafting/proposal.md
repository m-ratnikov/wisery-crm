## Why

A qualified prospect has a score but no message. Drafting is the default `Qualified -> Queued` path (ADR-0007, ADR-0008): generate a personalized first-touch message from the prospect's signal and the user profile, so the prospect lands in the review queue with something for the human to approve and send. It consumes the `LLMProvider` port (Wave 1) and the user profile config-as-data (Wave 2), and closes the hook qualification left open: enqueue a draft when a prospect qualifies.

## What Changes

- **One data table** (next migration): `drafts` (`prospect_id` + `profile_id` FKs, `channel`, `body`, a `draft_status` enum `generated | selected | archived`, `provider` / `prompt_version` / `model` for eval traceability, `created_at`). Models the domain-model `DRAFT` entity.
- **The drafter**: a versioned prompt (`src/prompts/draft_v1.ts`) that writes a first-touch message from the **user profile** (positioning, offer, voice, case studies - config-as-data) and the **prospect's signal**, through the `LLMProvider` port's structured-output contract. This is the default signal-grounded touch; grounding a richer re-draft in a `Dossier` is the `enrichment` capability's extension (it owns the dossiers table and the re-draft trigger, ADR-0007) - not built here, since enrichment is not yet built.
- **The draft job**: `draftProspect(prospectId)` - load the qualified prospect, its signal, and the active user profile; generate the draft; persist a `Draft` (the selected one); move the prospect to `queued` (ADR-0008 disposition). One job per prospect, `singleton` queue policy + a has-draft guard for idempotency (the pattern proven in qualification's review-remediation).
- **The enqueue-on-qualify hook**: when qualification marks a prospect `qualified`, a draft job is enqueued. Wired at the composition root (`registerQualifyWorker({ onProspectsQualified })`) so `qualification` never imports `drafting` - the same dependency-safe seam used for scan -> qualify.
- **Re-draft ready** (ADR-0007): a `Draft` is regenerable - generating a new selected draft archives the prior one - so enrichment's later re-draft is additive, no shape change.

Not in scope: enrichment / the dossier producer (`enrichment` capability); the review-queue UI (`review-queue`); sending (never automated, D2); below-bar prospects (not drafted).

## Capabilities

### New Capabilities
- `drafting`: a qualified prospect is automatically drafted into a personalized first-touch message from the user profile and the signal (or the dossier when enriched), through the LLM port; the draft is persisted and the prospect moves to queued; drafts are regenerable (re-draft archives the prior selected); every draft records its provider/prompt/model for eval traceability.

### Modified Capabilities
<!-- None at the spec level. The enqueue-on-qualify hook is drafting's requirement (below); realizing it adds an onProspectsQualified callback to qualification's worker, wired at the composition root - qualification's contract is unchanged (the hook it reserved). -->

## Impact

- **Schema / migrations**: `src/lib/db/schema.ts` gains `drafts` + the `draft_status` pg enum; next migration (immutable, ordered after the qualification migrations).
- **New code**: `src/lib/draft/` - the drafter (reads profile + signal + optional dossier, calls the port), the draft pipeline (`draftProspect`), the draft queue + worker; `src/prompts/draft_v1.ts`.
- **Reused seams**: `LLMProvider` port (`getLLM()`, fake injected in tests), `src/lib/icp` (`getUserProfile`), `src/lib/db`, `src/lib/jobs`. Adds `onProspectsQualified` to `qualification`'s worker (additive) and the `enqueueDraftForProspects` wiring in `bootstrapNodeRuntime()`.
- **Tests**: integration (gated, fake LLM) - drafting a qualified prospect persists a `selected` Draft with provider/prompt/model and moves it to `queued`; idempotency (a re-run does not double-draft); a below-bar prospect is not drafted. Unit test the draft-result mapping.
- **Canon accuracy**: the domain-model `DRAFT` (and `SCORING`) entity field lists gain `provider` to match the code (drafts and scorings both record it per ADR-0003); a small doc edit, not a new decision.
- **Governed by**: ADR-0007 (default draft-from-signal, optional enrichment), ADR-0008 (queued disposition; drafted is derived from the DRAFT relation), ADR-0003/D9 (LLM via the port), D5 (draft is a separate call from qualify), Drizzle-migrations-immutable.
