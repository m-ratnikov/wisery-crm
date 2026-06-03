## Why

Drafting writes a first touch from the thin signal. Enrichment is the optional, paid step that deepens a qualified prospect into a full dossier so the draft can be regenerated from real research (the hyper-personalization thesis, D5). Per ADR-0007 it is **user-triggered and optional by default, with an opt-in auto-enrich setting** - never an automatic spend. This change builds the `EnrichmentProvider` port (D4/ADR-0002), the dossier, the trigger (single, batch, and auto), and the dossier-grounded re-draft, closing the enrichment seam the drafting capability deferred.

## What Changes

- **Two data tables** (next migration): `dossiers` (`prospect_id` FK unique - one per prospect, `data` jsonb enrichment bundle, `provider`, `enriched_at`) and `settings` (a single-row per-tenant config holding `auto_enrich`, config-as-data, D1). Models the domain-model `DOSSIER`.
- **The `EnrichmentProvider` port** (D4, ADR-0002): a provider-neutral interface that takes a prospect's signal and returns an enrichment bundle + provider id. Apify is the **default adapter** (managed, keeps detection risk off the user's account, D2); a deterministic **fake provider** ships for offline tests; the Apify network call is the coverage-excluded seam (proven by a live smoke when `APIFY_API_TOKEN` is set), the same shape as the Anthropic adapter.
- **The enrich job**: `enrichProspect(prospectId)` - call the provider, upsert the `Dossier` (one per prospect), and trigger a re-draft grounded in it. One job per prospect, `singleton` queue policy + the no-error-swallow worker (the proven patterns).
- **The trigger (ADR-0007)**: **manual** (`enqueueEnrich(prospectId)` from a prospect's detail) and **batch** (`enqueueEnrichForProspects(ids)` from a grid multi-select) - the default; plus an **opt-in auto** path - when the `auto_enrich` setting is on, a newly qualified prospect is enriched instead of drafted-from-signal. The default remains qualify -> draft from the signal.
- **Dossier-grounded re-draft**: enrichment extends the drafter so that when a `Dossier` exists, the draft is grounded in it (the extension drafting deferred to enrichment); the re-draft is a forced draft (it supersedes a signal-only draft if one exists).
- **Composition-root routing**: the qualify -> next-stage hook routes to enrich (auto on) or draft (auto off) by the setting; the enrich -> re-draft hook is wired the same dependency-safe way - no stage imports the next.

Not in scope: the prospect-list/detail UI that calls the manual/batch trigger (`prospect-list` capability) and the Settings UI for the flag (prototype/`prospect-list`); the self-host Playwright adapter (ADR-0002 escape hatch, behind the same port, added when needed); company/content expansion.

## Capabilities

### New Capabilities
- `enrichment`: a qualified prospect can be deep-enriched into a one-per-prospect dossier through a provider-neutral port (Apify default, fake for tests); enrichment is user-triggered (single or batch) and optional by default, with an opt-in auto-enrich setting that enriches on qualification; enriching a prospect grounds a re-draft in the dossier; the dossier and the auto-enrich setting are config/data the engine reads.

### Modified Capabilities
<!-- None at the spec level. The drafter gaining dossier-awareness realizes the extension
drafting's spec already deferred to enrichment ("grounding a re-draft in a dossier is owned
by the enrichment capability"); it adds no drafting requirement. -->

## Impact

- **Schema / migrations**: `src/lib/db/schema.ts` gains `dossiers` (unique `prospect_id`) + `settings`; next migration (immutable, after 0005).
- **New code**: `src/lib/enrich/` - the `EnrichmentProvider` port + types, the Apify adapter, the fake provider, `getEnrichmentProvider()`, the enrich pipeline + queue; a settings module (`getSettings`/`setAutoEnrich`). Extends `src/lib/draft/drafter.ts` to read an optional dossier; adds `force` to the draft job payload; wires the routing + re-draft hooks in `bootstrapNodeRuntime()`.
- **Reused seams**: `src/lib/db`, `src/lib/jobs`, the draft pipeline (forced re-draft), `src/lib/icp` profile. New env var `APIFY_API_TOKEN` (optional, like `ANTHROPIC_API_KEY`) added to `src/lib/config/env` + `.env.example`; the Apify adapter errors clearly if used without it.
- **Tests**: integration (gated, fake enrichment + fake LLM) - enrich a prospect creates a one-per-prospect dossier and re-drafts from it; the unique constraint enforces one dossier per prospect; the auto-enrich routing (on -> enrich, off -> draft); manual + batch enqueue. Unit-test the fake provider + the settings.
- **Governed by**: ADR-0007 (user-triggered/optional/opt-in-auto), ADR-0002 (Apify default behind the port), ADR-0008 (enriched is derived from the DOSSIER relation, not a status), D4 (port/adapter), D5 (draft from the dossier), D10 (PII minimization attaches at the qualify boundary - noted, deferred). Drizzle-migrations-immutable.
