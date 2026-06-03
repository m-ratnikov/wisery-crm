## Context

`signal-ingestion` set the data-layer conventions and `llm-provider` the port for the qualify call. The qualifier (Wave 3) scores against the ICP rubric and drafts in the user's voice, both of which must be config-as-data (D6, D1). This change adds the `rubric` and `user_profile` tables (migration 2, ordered after migration 1), a config-as-data module to read/write them with additive versioning, a starter seed, and the wired config anchor view (graduating the prototype `icp-config` screen). Next 16 Server Actions are the mutation mechanism (verified against `node_modules/next/dist/docs/01-app/01-getting-started/07-mutating-data.md`).

## Goals / Non-Goals

**Goals:** rubric + user_profile as versioned config-as-data; an active rubric; additive-versioned saves (a referenced rubric is never rewritten); an idempotent starter seed so the pipeline can run before hand-entry; the wired anchor view (rubric/profile/sources) reading live data with Server Actions.

**Non-Goals:** scoring (Wave 3); concrete connectors (`source-adapters`); auth on actions (D1); `tenant_id` (D1); a rubric-diff/history viewer (versions persist, but browsing them is a later additive UI).

## Decisions

### D-A: Two tables, JSONB criteria, additive versioning
`rubric` (`id` uuid, `name` text, `rubric` jsonb, `version` integer, `active` boolean, `created_at`/`updated_at`) and `user_profile` (`id` uuid, `profile` jsonb, `version` integer, `created_at`/`updated_at`). The scoring criteria and the profile are JSONB (config-shaped, D-E from signal-ingestion); `version`/`active` are typed columns. A save never updates a rubric row in place: it inserts a new `version` and flips `active` (the prior active row stays, immutable), so a past Scoring's rubric is never rewritten - the learning-loop invariant (domain-model). `user_profile` is likewise append-version; drafts read the latest.

### D-B: One active rubric, enforced by the write path
`getActiveRubric()` returns the single `active` row (highest version). `saveRubric()` runs in a Drizzle transaction: deactivate the current active row, insert the new version as active. A partial unique index (`active` where true) is the belt-and-suspenders guard so two active rubrics cannot coexist. `version` is `max(version)+1` computed in the transaction.

### D-C: The rubric/profile JSON shapes are Zod schemas in `src/lib/icp`
The JSONB columns are validated at the app boundary by Zod (the DB does not validate JSONB). `rubricSchema` (ideal titles/stages, positive signals, disqualifiers, 1-5 bands, insufficient-data rule, platform note) and `userProfileSchema` (positioning, offer, voice, case studies) mirror the prototype `_data/icp-config.ts` types and the domain model. These schemas are the contract the qualifier (Wave 3) will read and the Server Actions validate before persisting.

### D-D: Module layout - `src/lib/icp/`, all `server-only`
- `schema.ts` - the `rubricSchema` / `userProfileSchema` Zod schemas + inferred types.
- `config.ts` - `getActiveRubric()`, `getUserProfile()`, `saveRubric(input)`, `saveUserProfile(input)` over `getDb()`.
- `seed.ts` - `seedIcpConfig()`: idempotent insert of the starter rubric + profile if none exists.
Reuses `src/lib/db` and `src/lib/config`; no jobs/LLM dependency (config is upstream of both).

### D-E: The anchor view is a Server Component + Server Actions
A new non-prototype route renders the active rubric, the profile, and the live sources (Server Component reading via the `src/lib/icp` + `src/lib/signals` read paths). Edits post through `'use server'` actions (`saveRubricAction`, `saveProfileAction`, `toggleSourceAction`, `scanSourceAction`) that validate with the Zod schemas, write through the config-as-data layer, and `revalidatePath` the route. Per-tab editor components are adapted from the prototype; complex inline-array editing stays a Client Component receiving the action as a prop (Next 16 pattern). The Sources tab toggles `enabled` and calls `enqueueScan`; creating a source writes a `sources` row (kind constrained to registered connector kinds - today `fixture`; real kinds light up with `source-adapters`).

### D-F: Server Actions are unauthenticated by design (D1), documented
D1 defers auth; the app is single-user. The actions carry a short comment and the route a note that authorization is deferred to the productization milestone (the Next data-security warning is acknowledged, not yet actionable). This is the single designated place that decision surfaces in code.

### D-G: Seed content is the ported ICP, not invented
`seedIcpConfig()` uses the fractional-CTO rubric + profile already written in the prototype `_data/icp-config.ts` (itself the port of `job-monitor`'s `ICP_SYSTEM_PROMPT` and `gtm.md`), so the seed is the real ICP, not placeholder text. The prototype file stays the design reference; the seed values live in `src/lib/icp/seed.ts` (the prototype never imports `src/lib`, so the content is restated, not shared - a deliberate copy at the prototype boundary).

## Risks / Trade-offs

- **Two active rubrics if a save races** -> the partial unique index on `active` makes it impossible at the DB; `saveRubric` does deactivate-then-insert in one transaction.
- **Seed drift from the prototype** -> the seed restates the prototype ICP; they can diverge. Accepted: the prototype is a mock and the seed is the source of truth once it runs; a comment cross-links them.
- **Unauthenticated Server Actions** -> acceptable under D1 (single-user); the seam is documented so productization adds auth in one place.
- **Editing UI scope** -> the wired editors prioritize correctness of persistence over the prototype's full affordance set; missing niceties are additive, not a contract change.

## Migration Plan

1. Add `rubric` + `user_profile` to `src/lib/db/schema.ts` (D-A) with the partial unique index on `rubric.active`.
2. `npm run db:generate` -> review migration 2 SQL (tables, partial unique index); `npm run db:migrate`.
3. Build `src/lib/icp/` (schemas, config-as-data, seed) with integration tests.
4. Build the wired anchor view (Server Component + Server Actions + adapted editor components).
5. Update the prototype registry note. Run `seedIcpConfig()` against dev and confirm the active rubric reads back.
6. **Rollback:** drop the two tables (nothing references them until Wave 3); migrations stay immutable - corrections are new migrations.

## Open Questions

- Whether `saveRubric` should also support editing-without-new-version for typo fixes before any Scoring references it - deferred; always-new-version is simpler and safe, storage is cheap at single-user scale.
- The eventual rubric/profile version-history browser - versions persist now; the UI to browse/restore them is a later additive change.
