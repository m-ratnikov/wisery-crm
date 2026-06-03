## 1. Schema and migration

- [x] 1.1 Add the `dossiers` table to `src/lib/db/schema.ts`: uuid PK, `prospect_id` FK -> prospects RESTRICT, `data` jsonb NOT NULL, `provider` text NOT NULL, `enriched_at` timestamptz default now; a UNIQUE constraint/index on `prospect_id` (one dossier per prospect) (D-A)
- [x] 1.2 Add the `settings` table: uuid PK, `auto_enrich` boolean NOT NULL default false, `...timestamps()` (D-A)
- [x] 1.3 `npm run db:generate`; review the migration (tables, unique on dossiers.prospect_id); confirm ordered after 0005; `npm run db:migrate`

## 2. Settings (the auto-enrich flag)

- [x] 2.1 Create `src/lib/enrich/settings.ts` (`server-only`): `getSettings()` (returns the single row, inserting `{ auto_enrich: false }` if none - idempotent) and `setAutoEnrich(boolean)` (D-A, D-G)

## 3. The EnrichmentProvider port + adapters

- [x] 3.1 Create `src/lib/enrich/provider.ts` (`server-only`): the `EnrichmentProvider` interface (`name`, `enrich(signal): Promise<EnrichmentResult>`), `EnrichmentResult` (`{ data: unknown; provider: string }`), and `EnrichmentProviderError` (D-B)
- [x] 3.2 Create `src/lib/enrich/fake.ts` (`server-only`): `createFakeEnrichment(handler)` returning a deterministic provider (D-C)
- [x] 3.3 Create `src/lib/enrich/apify.ts` (`server-only`): `createApifyEnrichment()` reading `APIFY_API_TOKEN` (throws `EnrichmentProviderError` if absent when called); the network call structured but coverage-excluded (verify the Apify client API against node_modules if a client is added; otherwise a typed fetch) (D-C)
- [x] 3.4 Create `src/lib/enrich/index.ts` (`server-only`): `getEnrichmentProvider()` returning the memoized default (apify); the only module wiring the concrete adapter (D-C). Add a dependency-cruiser rule (port not -> adapters), mirroring llm
- [x] 3.5 Add `APIFY_API_TOKEN` (optional) to `src/lib/config/env.ts` and `.env.example` (D-H)

## 4. The enrich pipeline + queue

- [x] 4.1 Create `src/lib/enrich/pipeline.ts` (`server-only`) `enrichProspect(prospectId, { provider })`: load the prospect; no-op if not `qualified`/`queued` (below-bar never enriched); load its signal; call `provider.enrich(signal)`; upsert the dossier (`onConflictDoUpdate` on the unique `prospect_id`) with data/provider/enriched_at (D-D)
- [x] 4.2 Create `src/lib/enrich/enrich-queue.ts` (`server-only`): `enqueueEnrich(prospectId)` (singletonKey), `enqueueEnrichForProspects(ids)` (resilient), `registerEnrichWorker(opts?: { onEnriched })` (singleton policy, no error-swallow) calling `enrichProspect` and handing enriched ids to `onEnriched` (D-E)

## 5. Drafter dossier-awareness + forced re-draft plumbing

- [x] 5.1 Extend `src/lib/draft/drafter.ts` `draftMessage(signal, profile, { llm, dossier? })` to include the dossier bundle in the prompt context when present (D-F)
- [x] 5.2 In `src/lib/draft/pipeline.ts`, load the prospect's dossier (if any) and pass it to `draftMessage` so a draft is dossier-grounded when enriched (D-F)
- [x] 5.3 Add an optional `force` to the draft job payload in `src/lib/draft/draft-queue.ts` (`enqueueDraft(prospectId, force?)`, `enqueueDraftForProspects(ids, force?)`; the worker passes it to `draftProspect`) (D-F)

## 6. Composition-root routing

- [x] 6.1 In `bootstrapNodeRuntime()`: register the enrich worker; set the qualify hook to route by `getSettings().autoEnrich` (on -> `enqueueEnrichForProspects`, off -> `enqueueDraftForProspects`); wire the enrich worker `onEnriched` -> `enqueueDraftForProspects(ids, true)` (forced re-draft). No stage imports the next (D-G)

## 7. Tests (fakes, no network)

- [x] 7.1 Unit-test the fake enrichment provider and `EnrichmentProviderError`; unit-test `getEnrichmentProvider` default name
- [x] 7.2 Integration test (gated, fake provider + fake LLM): enriching a qualified prospect creates exactly one dossier (data + provider) and a re-draft grounded in it becomes the selected draft
- [x] 7.3 Integration test: re-enriching updates the single dossier (the unique constraint holds; no second dossier); a below-bar prospect is not enriched
- [x] 7.4 Integration test: settings default to auto-enrich off; `setAutoEnrich(true)` then `getSettings()` reflects it (the routing decision source)

## 8. Verify, canon, re-review, archive

- [x] 8.1 Exclude `src/lib/enrich/enrich-queue.ts` and `src/lib/enrich/apify.ts` from coverage (boot glue / network seam), with the documented rationale; cover the port/fake/pipeline/settings/accessor via tests
- [x] 8.2 `npm run depcruise` confirms the new enrich port/adapter rule passes
- [x] 8.3 `npm run verify` green (typecheck, lint, format, depcruise, dup, per-file coverage, build) against a reachable test Postgres
- [x] 8.4 Re-review the fix delta in context (READ-ONLY agent) per the looping rule, then `/opsx:verify` (conformance to ADR-0007/0002/0008, D4/D5) and archive
