## 1. Schema and migration

- [x] 1.1 Add the `rubric` table to `src/lib/db/schema.ts`: uuid PK (`gen_random_uuid()`), `name` text, `rubric` jsonb (typed via `$type`), `version` integer, `active` boolean default false, `created_at` defaultNow, `updated_at` via `.$onUpdate()` (D-A)
- [x] 1.2 Add the `user_profile` table: uuid PK, `profile` jsonb, `version` integer, `created_at`, `updated_at` (D-A)
- [x] 1.3 Add a partial unique index on `rubric` where `active` is true, so at most one active rubric can exist (D-B)
- [x] 1.4 Run `npm run db:generate`; review migration 2 SQL (two tables, partial unique index); confirm it is ordered after migration 1 and adds no new env var
- [x] 1.5 Run `npm run db:migrate` and confirm `rubric` + `user_profile` exist with the partial unique index

## 2. Config-as-data Zod schemas

- [x] 2.1 Create `src/lib/icp/schema.ts` (`server-only`): `rubricSchema` (ideal titles/stages, positive signals, disqualifiers, bands [score 1-5 + criteria], insufficient-data rule, platform note) and `userProfileSchema` (positioning, offer, voice, case studies), mirroring the prototype `_data/icp-config.ts` types and the domain model; export inferred types (D-C)

## 3. Config-as-data read/write

- [x] 3.1 Create `src/lib/icp/config.ts` (`server-only`): `getActiveRubric()` (the active row, validated against `rubricSchema`) and `getUserProfile()` (latest version) (D-B, D-D)
- [x] 3.2 `saveRubric(input)`: validate with `rubricSchema`, then in one Drizzle transaction deactivate the current active row and insert `max(version)+1` as active (additive versioning, never update-in-place) (D-A, D-B)
- [x] 3.3 `saveUserProfile(input)`: validate with `userProfileSchema`, insert `max(version)+1` as the new latest (D-A)

## 4. Starter seed

- [x] 4.1 Create `src/lib/icp/seed.ts` (`server-only`): `seedIcpConfig()` - idempotent; if no rubric exists, insert the fractional-CTO starter rubric (active, v1) restated from the prototype `_data/icp-config.ts`; if no profile exists, insert the starter profile (v1). Cross-link the prototype file in a comment (D-G)

## 5. The wired anchor view (Server Component + Server Actions)

- [x] 5.1 Create the non-prototype route (e.g. `src/app/(app)/icp-config/page.tsx`) as a Server Component reading `getActiveRubric()`, `getUserProfile()`, and live `sources`; render the rubric / profile / sources tabs (adapt editor components from the prototype) (D-E)
- [x] 5.2 Create `src/app/(app)/icp-config/actions.ts` (`'use server'`): `saveRubricAction`, `saveProfileAction`, `toggleSourceAction(sourceId, enabled)`, `scanSourceAction(sourceId)` - validate with the Zod schemas, write via `src/lib/icp` and `src/lib/signals` (`enqueueScan`), then `revalidatePath` the route (D-E)
- [x] 5.3 Add the D1 note: a comment in `actions.ts` and on the route that authorization is deferred (single-user, D1); acknowledge the Next data-security caveat (D-F)
- [x] 5.4 Source-create writes a `sources` row with `kind` constrained to registered connector kinds (today `fixture`); document that real kinds (linkedin-search, x-posts) light up with `source-adapters` (D-E)

## 6. Tests

- [x] 6.1 Unit-test `rubricSchema` and `userProfileSchema`: a valid rubric/profile passes; a bad band score or missing required field fails
- [x] 6.2 Integration test (gated on `TEST_DATABASE_URL`): `seedIcpConfig()` then `getActiveRubric()` returns the seeded active rubric; a second `seedIcpConfig()` is a no-op (idempotent)
- [x] 6.3 Integration test: `saveRubric()` twice yields two version rows, only the latest `active`, and `getActiveRubric()` returns it; the prior version row is retained unchanged (additive versioning)
- [x] 6.4 Integration test: `saveUserProfile()` twice yields two versions and `getUserProfile()` returns the latest
- [x] 6.5 Integration test or DB assertion: the partial unique index rejects a second active rubric (the write path never triggers it, but the guard holds)

## 7. Verify, prototype registry, and docs

- [x] 7.1 Exclude only what is genuinely network/boot glue from coverage; cover `src/lib/icp/**` via the unit + integration tests (no new performative exclusions)
- [x] 7.2 Update `src/app/prototype/README.md`: note the `icp-config` screen is graduated to a wired anchor view at its real route; keep the prototype as the design reference
- [x] 7.3 Run `npm run verify` green (typecheck, lint, format, depcruise, dup, per-file coverage, build) against a reachable test Postgres
- [x] 7.4 Run a `code-review` pass with architecture context and `/opsx:verify` (conformance to design + D1/D6) before archive
