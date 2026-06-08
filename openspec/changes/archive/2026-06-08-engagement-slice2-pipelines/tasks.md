# Tasks

## 1. Schema + migrations
- [x] 1.1 Add `pipeline` + `pipeline_status` tables (composite-FK target unique `(pipeline_id, id)`, `(pipeline_id, position)` unique).
- [x] 1.2 Add `person.pipeline_id` + `person.status_id` + composite FK; generate migration 0016 (additive) and append the idempotent seed (LinkedIn outreach + 10 statuses) + backfill-to-Cold SQL.
- [x] 1.3 Swap: make the FK columns NOT NULL and drop `person.status` (migration 0017). Both migrations apply with no interactive prompt; journal/snapshot in sync (db:generate reports no drift).

## 2. Pipeline module + qualification read
- [x] 2.1 `src/lib/pipeline/config.ts`: getDefaultPipeline, getEntryStatus, setPersonStatus.
- [x] 2.2 `src/lib/qualify/read.ts`: qualificationFor / qualificationForMany (latest icp Scoring >= 3 = qualified; < 3 / -1 = below_bar; none = unassessed). Retire prospectStatusSchema.

## 3. Rewire writes + reads
- [x] 3.1 approveSignal / qualifyProspect / addManualLead create people at the entry status; re-score no longer sets the pipeline position.
- [x] 3.2 loadActionableProspect gates on the qualification read; listProspects / getProspectDetail resolve status to the pipeline_status name and add `qualification`.

## 4. UI + gate
- [x] 4.1 Status-setter `<select>` + setStatusAction; qualification badge; filter driven by the pipeline statuses.
- [x] 4.2 Tests (pipeline seed, setPersonStatus, qualification read, updated triage/manual/qualification/enrichment) + `npm run verify` green + code-review pass applied (stale enrich comments fixed).
