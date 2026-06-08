## Context

ADRs 0013-0018 are accepted and the architecture canon (docs/architecture/*, docs/product-overview.md) already reflects them. The code still uses `prospects`/`Prospect`/`prospectId` end to end. This change reconciles the code's data model to the canon's `Person` model and adds the (still dormant) entities the later slices need, without changing any pipeline behavior. The `PersonIdentity` seam from ADR-0010 already isolates the one origin branch, so the qualifier/drafter/loaders consume identity through it - the rename does not reopen that.

## Goals / Non-Goals

**Goals:** the `Prospect -> Person` rename (data-preserving), the Person facets (`type`, `monitored`, `company_id`), the `companies` and `signal_decisions` tables, and `rubric.kind` + the per-kind active constraint - all with zero behavior change for the existing `type = prospect` pipeline.

**Non-Goals:** universal triage (next slice), posts/Feed (slice 3), comments (slice 4). No advisory filter, no Queue triage lane, no company-to-people expansion job. The new entities are created but nothing writes/reads them yet beyond defaults.

## Decisions

### D1. The rename is a true SQL rename, verified, never drop+create

Drizzle infers a rename only when the table/column rename is unambiguous; otherwise `db:generate` emits `DROP`+`CREATE`, which loses rows. Author the rename so the generated migration contains `ALTER TABLE "prospects" RENAME TO "person"` and `ALTER TABLE ... RENAME COLUMN "prospect_id" TO "person_id"` (use drizzle-kit's rename prompt, or hand-write the migration and reconcile the snapshot). Read the generated SQL and confirm no `DROP TABLE`/`DROP COLUMN` before applying. Existing FKs, indexes, and the per-origin CHECK from ADR-0010 must survive the rename.

### D2. Facets and new entities default to the pre-engagement world

`person.type` defaults `'prospect'`, `person.monitored` defaults `false`, `person.company_id` is nullable - so every existing row reads as a non-monitored prospect with no company, no backfill. `companies` and `signal_decisions` are empty until the triage slice populates them. `signal_decisions.signal_id` is `UNIQUE` (one decision per signal, ADR-0014); `created_entity_id` is a plain nullable uuid (a convenience denormalization, not an FK - the reverse FKs `person.signal_id`/`companies.signal_id` are authoritative).

### D3. `rubric.kind` defaults `'icp'`, constraint becomes per-kind

Add `kind text NOT NULL DEFAULT 'icp'`; existing rubric rows become `icp` with no backfill. Replace the `rubric_one_active_uq` partial unique index (`ON (active) WHERE active`) with `ON (kind) WHERE active`, so one active rubric per kind. The qualifier's selection changes from "the active rubric" to "the active rubric WHERE kind = 'icp'" - same row today, kind-aware for later.

### D4. Symbol refactor is mechanical and behavior-preserving

Rename the `Prospect` type and `prospectId` parameters/columns to `Person`/`personId` across `src/lib/db`, `src/lib/qualify`, `src/lib/draft`, `src/lib/enrich`, `src/lib/prospect`, `src/lib/queue`, and the `prospect-list`/`review-queue` app routes. No control flow changes. The two build-enforced seams (db-only cores, port/adapter direction) are unaffected. `npm run verify` (typecheck + dependency-cruiser + tests) is the regression guard.

## Risks

- The rename migration is the one irreversible step; D1's verification (read the SQL, confirm rename-not-recreate) is the mitigation. Author it isolated from any other in-flight migration (serial journal).
- `dependency-cruiser` boundary names that key on `prospect` paths may need their rule globs updated alongside the directory/file renames.
