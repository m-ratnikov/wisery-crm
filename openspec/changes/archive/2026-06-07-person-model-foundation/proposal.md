## Why

ADRs 0013-0018 are accepted canon (the content-marketing-engagement architecture). This change lands the **schema + model foundation** they all rest on - the `Prospect -> Person` rename, the new facets and entities, and the refactors the rename forces - with **no new user-facing behavior**. Front-loading it (foundation-first) means the three feature slices that follow (universal triage, posts + Feed, comments) build on a `person` model that already exists, so each of those is additive code rather than its own schema rework. It also honors ADR-0015's intent that the engagement tables are authored against `person` from the start.

## What Changes

- **Migration (rename, data-preserving)**: `prospects` -> `person`, and the `prospect_id` FK on `scorings`, `drafts`, `dossiers`, `outcomes` -> `person_id`. Authored as an explicit Drizzle rename so rows are preserved (not drop+create). (ADR-0015)
- **Migration (Person facets)**: add `type` (text, NOT NULL, default `'prospect'`, Zod `prospect | peer`), `monitored` (boolean, NOT NULL, default false), `company_id` (uuid FK -> `companies`, nullable). (ADR-0015, ADR-0016)
- **Migration (new tables)**:
  - `companies` - firmographic identity (`name`, nullable `domain`/`linkedin_url`/`firmographics` jsonb) + nullable `signal_id` FK. (ADR-0016)
  - `signal_decisions` - `signal_id` FK **unique**, `disposition` (text, Zod `approved | dismissed`), `created_entity_id` (uuid, nullable), `decided_at`. (ADR-0014)
- **Migration (rubric kind)**: add `rubric.kind` (text, NOT NULL, default `'icp'`, Zod `icp | peer | company`); replace `rubric_one_active_uq` (partial unique on `active`) with a partial unique on `(kind) WHERE active`. (ADR-0017)
- **Refactor (mechanical, behavior-preserving)**: rename the `Prospect`/`prospectId` symbols to `Person`/`personId` across `src/lib/db`, the qualify/draft/enrich/queue modules, and the prospect-list/review-queue surfaces. The `PersonIdentity` seam (ADR-0010) already abstracts identity, so consumers mostly rename; no pipeline behavior changes.

No triage, no Feed, no posts/comments here - those are the following slices. `companies`, `signal_decisions`, `rubric.kind`, `type`, and `monitored` are inert until the triage and engagement slices use them.

## Capabilities

### Modified Capabilities

- `qualification`, `drafting`, `enrichment`, `prospect-list`, `review-queue`: each is **renamed** from Prospect to Person with no behavior change; a `type = prospect` Person flows through exactly the pipeline a Prospect did. The qualifier reads `rubric WHERE kind = 'icp' AND active` (the existing single active ICP rubric) - kind-aware selection, same result today.

## Impact

- **Migrations**: authored serially (Drizzle's journal is serial - do not generate concurrently with another in-flight change). The rename must be a true rename in SQL (`ALTER TABLE ... RENAME`), verified by reading the generated migration, so existing rows survive.
- **New code**: `companies` + `signal_decisions` + `comment`-less schema in `src/lib/db/schema.ts`; Zod enums for `person.type`, `rubric.kind`, `signal_decisions.disposition`.
- **Modified code**: every `prospect`/`prospectId` reference (data layer, qualify, draft, enrich, queue read-models, prospect-list app routes). Largely mechanical; the `PersonIdentity` seam contains the only identity branch.
- **Governed by**: ADR-0014 (signal_decisions), ADR-0015 (Person rename + facets), ADR-0016 (Company), ADR-0017 (rubric kind). Canon already promoted (docs/architecture/domain-model.md).
- **Unaffected**: the `/prototype` tree (renamed labels only if any); enrichment/review transitions (origin- and type-agnostic for `type = prospect`).
