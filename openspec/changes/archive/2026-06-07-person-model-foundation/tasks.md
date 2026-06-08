## 1. Rename migration (data-preserving)

- [x] 1.1 In `src/lib/db/schema.ts` rename `prospects` -> `person` and the `prospectId` FK columns on `scorings`, `drafts`, `dossiers`, `outcomes` -> `personId`; keep every FK + `RESTRICT`, the indexes, and the ADR-0010 per-origin CHECK.
- [x] 1.2 `npm run db:generate` and READ the generated SQL: confirm it is `ALTER TABLE ... RENAME` (table + columns), with NO `DROP TABLE`/`DROP COLUMN`/`CREATE TABLE`. If drizzle-kit emits drop+create, use its rename prompt or hand-author the rename migration and reconcile the snapshot. Apply against a copy and confirm row counts are preserved.

## 2. Person facets + new entities migration

- [x] 2.1 On `person`: add `type` (text NOT NULL default `'prospect'`), `monitored` (boolean NOT NULL default false), `companyId` (uuid FK -> `companies`, nullable). Add an `origin`-style Zod enum `personType` (`prospect | peer`).
- [x] 2.2 Add `companies` table: uuid PK, nullable `signalId` FK, `name`, nullable `domain`/`linkedinUrl`, nullable `firmographics` jsonb, timestamps.
- [x] 2.3 Add `signal_decisions` table: uuid PK, `signalId` FK with a UNIQUE index, `disposition` (text + Zod `approved | dismissed`), nullable `createdEntityId` (uuid, not an FK), `decidedAt`. Add the disposition Zod enum.
- [x] 2.4 `npm run db:generate`; confirm the migration is additive (existing rows satisfy the new defaults, the `companies`/`signal_decisions` tables are new and empty).

## 3. Rubric kind migration

- [x] 3.1 On `rubric`: add `kind` (text NOT NULL default `'icp'`, Zod `icp | peer | company`). Replace the `rubric_one_active_uq` partial unique index (on `active`) with a partial unique on `(kind) WHERE active`.
- [ ] 3.2 Update the qualifier's rubric load to select the active rubric WHERE `kind = 'icp'` (kind-aware). DEFERRED to `universal-triage` (slice 3): a no-op today (only `icp` rubrics exist, so `getActiveRubric`'s `WHERE active` returns the one icp row), it becomes load-bearing when slice 3 introduces a `peer` rubric - that slice owns adding the `kind='icp'` filter so prospects are not scored on the peer rubric. Existing rubric rows already read as `icp` with no backfill (3.1 verified).

## 4. Symbol refactor (behavior-preserving)

- [x] 4.1 Rename the `Prospect` type to `Person` and `prospectId` params/locals to `personId` across `src/lib/db`, `src/lib/qualify`, `src/lib/draft`, `src/lib/enrich`, `src/lib/prospect`, `src/lib/queue`, and the `prospect-list`/`review-queue` app routes. No control-flow change.
- [x] 4.2 Update any `dependency-cruiser` rule globs and path aliases that key on `prospect` directory/file names so the boundary checks still bind.

## 5. Verification

- [x] 5.1 `npm run verify` green (typecheck, lint, format, dependency-cruiser, jscpd, per-file coverage, build) - the regression guard that the rename + refactor changed no behavior.
- [x] 5.2 Unit: a `type = prospect` person scores, qualifies, drafts, and queues exactly as before (golden-path assertions unchanged except the renamed identifiers); the new `companies`/`signal_decisions` tables and `person.type`/`monitored`/`company_id`/`rubric.kind` defaults are present and correct.
- [x] 5.3 Reviewed: the rename is mechanical and behavior-preserving, validated by the full 187-test suite (qualification/manual-lead/prospect-list/review-queue all green on the renamed code) plus a careful review of the hand-authored `0011_person_rename` migration SQL and the new schema. The heavy multi-agent `/code-review` was intentionally reserved for the feature slices (2-4), where the new logic lives.
