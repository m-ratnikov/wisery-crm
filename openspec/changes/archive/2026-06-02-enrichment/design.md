## Context

Drafting writes from the thin signal; enrichment (ADR-0007: optional, user-triggered, opt-in-auto) deepens a qualified prospect into a dossier and regenerates the draft from it. ADR-0002 puts enrichment behind the `EnrichmentProvider` port with Apify as the default managed adapter. This mirrors the now-established shapes: a provider-neutral port + fake (like `LLMProvider`), a singleton-policy queue worker that does not swallow errors, and composition-root hook wiring so no pipeline stage imports the next.

## Goals / Non-Goals

**Goals:** the `dossiers` (one-per-prospect) + `settings` tables; the `EnrichmentProvider` port + Apify adapter (coverage-excluded seam) + fake; the enrich pipeline (upsert dossier) + queue; the trigger - manual, batch, and opt-in auto; the dossier-grounded forced re-draft; all dependency-safe at the composition root. **Non-Goals:** the prospect-list/Settings UI that calls the triggers; the self-host Playwright adapter; company/content expansion; PII minimization mechanics (D10, deferred - noted at the boundary).

## Decisions

### D-A: `dossiers` (unique prospect_id) + a single-row `settings` table
`dossiers`: `id`, `prospect_id` FK -> prospects RESTRICT with a **unique** constraint (one per prospect), `data` jsonb (opaque enrichment bundle - the DB does not interpret it), `provider` text, `enriched_at` timestamptz. `settings`: `id`, `auto_enrich` boolean default false, `created_at`/`updated_at`. Settings is single-row config-as-data (D1); `getSettings()` returns the row, inserting a default (`auto_enrich=false`) if none exists (idempotent).

### D-B: The `EnrichmentProvider` port is provider-neutral; the dossier stores an opaque bundle
```ts
interface EnrichmentResult { data: unknown; provider: string; }
interface EnrichmentProvider { readonly name: string; enrich(signal: SignalRow): Promise<EnrichmentResult>; }
```
The bundle is stored as JSONB without the system interpreting its shape, so the Apify actor's output shape is not a contract here (D4 normalize-at-the-edge is the connector concern; enrichment stores research as data). The drafter consumes it as context, not as typed fields.

### D-C: Apify is the default adapter; a fake for tests; the network call is the excluded seam
`getEnrichmentProvider(name?)` returns the configured default (`apify`), the fake injected under test (the `getLLM` pattern). The Apify adapter reads `APIFY_API_TOKEN` from config and errors clearly (`EnrichmentProviderError`) if absent when called; its network call is coverage-excluded and proven by a live smoke when a token exists. The fake returns a deterministic bundle.

### D-D: The enrich pipeline upserts one dossier; the re-draft is wired at the root
`enrichProspect(prospectId, { provider })`: load the prospect; no-op if it is not in a draftable/enrichable disposition (`qualified` or `queued`) - a below-bar prospect is never enriched; load its signal; call `provider.enrich(signal)`; **upsert** the dossier (`onConflictDoUpdate` on the unique `prospect_id`, so re-enrich updates the one dossier). The re-draft is not called from here (that would import drafting); the enrich worker returns the enriched prospect ids and the composition root wires them to a forced re-draft (D-J).

### D-E: Enrich queue + worker (the proven patterns)
`enqueueEnrich(prospectId)` (singletonKey), `enqueueEnrichForProspects(ids)` (resilient per-id), `registerEnrichWorker(opts?: { onEnriched })` with `policy: "singleton"` and no error-swallowing catch. The worker calls `enrichProspect` and hands the enriched ids to `onEnriched`.

### D-F: The drafter becomes dossier-aware (the extension drafting deferred)
`draftMessage(signal, profile, { llm, dossier? })` includes the dossier bundle in the prompt context when present; `draftProspect` loads the prospect's dossier (if any) and passes it. A draft with a dossier is grounded in the research; without one, in the signal (the existing default). The draft job payload gains an optional `force`, so the post-enrich re-draft (forced) supersedes a signal-only draft.

### D-G: Composition-root routing by the auto-enrich setting
The qualify -> next-stage hook reads `getSettings().autoEnrich`: on -> `enqueueEnrichForProspects`, off -> `enqueueDraftForProspects` (the default). The enrich -> re-draft hook (`onEnriched`) -> `enqueueDraftForProspects(ids, { force: true })`. Both decisions live in `bootstrapNodeRuntime()` (it already imports the stage modules), so qualification/enrichment/drafting never import one another. The full graph: scan -> qualify -> (auto? enrich -> re-draft : draft).

### D-H: Config - `APIFY_API_TOKEN` optional, like the Anthropic key
Added to `src/lib/config/env` as optional; the Apify adapter fails legibly if used without it. No test needs it (the fake is injected).

## Risks / Trade-offs

- **Apify cost / the network call unproven without a token** -> tests use the fake; a live smoke validates the adapter when a token is set (same posture as the LLM adapter). Cost is opt-in by ADR-0007 (manual default).
- **One-dossier-per-prospect via a unique constraint + upsert** -> re-enrich updates, never duplicates; the DB enforces it (not just app logic), the lesson from drafting's review.
- **Forced re-draft after enrich** -> `force` bypasses the has-selected guard so the dossier draft supersedes the signal draft; the one-selected partial unique index (drafting) still guarantees a single selected.
- **PII to a third-party enricher (D10)** -> field minimization attaches at the qualify boundary, deferred until productization; the enrichment input is the signal, noted as the data-processor surface.

## Migration Plan

1. Add `dossiers` (unique prospect_id) + `settings` to `schema.ts`; `db:generate` -> review the migration; `db:migrate`.
2. Build `src/lib/enrich/` (port, apify, fake, accessor, pipeline, queue) + the settings module; add `APIFY_API_TOKEN` to config + `.env.example`.
3. Extend the drafter for an optional dossier; add `force` to the draft job payload.
4. Wire the routing + re-draft hooks in `bootstrapNodeRuntime()`.
5. Integration-test (fake enrichment + fake LLM): enrich -> one dossier + re-draft from it; unique constraint; auto-on routes to enrich, auto-off to draft; manual/batch enqueue. Exclude `enrich-queue.ts` + the Apify adapter from coverage.
6. **Rollback:** drop `dossiers` + `settings` (nothing references them downstream yet); migrations immutable.

## Open Questions

- The Apify actor id/input mapping per source kind - pinned when the token + a real actor are available; the port hides it.
- Whether `settings` should be keyed by tenant now - single row for single-tenant MVP; `tenant_id` is the additive productization hook (D1).
