# Why

Implements Slice 2 of the engagement-rework (ADR-0020, now canon): configurable pipelines replace the fixed `Person.status` enum, and qualification (qualified / below_bar / unassessed) becomes a derived read over the latest icp-rubric Scoring rather than a stored status. Code realization of the architecture ratified in `openspec/changes/archive/2026-06-08-engagement-rework`.

# What Changes

- New `pipeline` + `pipeline_status` tables (config-as-data, peers of Rubric / User Profile). `pipeline_status` has the composite-FK target unique index `(pipeline_id, id)` and a `(pipeline_id, position)` unique.
- `Person.status` (text) becomes `Person.pipeline_id` + `Person.status_id` FKs, with a composite FK `(pipeline_id, status_id) -> pipeline_status(pipeline_id, id)` so the database (not an app check) guarantees a person's status always belongs to its pipeline (ADR-0020). Migration is two steps: `0016` (additive: tables + nullable FK columns + composite FK + idempotent seed of the "LinkedIn outreach" default pipeline [Cold, CR Sent, CR Accepted, FU Sent, Conversation, Discovery call, Not Interested, Ghosted, Proposal Sent, On Hold] + backfill every existing person to Cold) then `0017` (SET NOT NULL + DROP COLUMN status). TTY-safe (additive then swap, no rename prompt).
- New `src/lib/pipeline/config.ts`: `getDefaultPipeline`, `getEntryStatus`, `setPersonStatus`. New `src/lib/qualify/read.ts`: `qualificationFor` / `qualificationForMany` (latest icp-rubric Scoring >= 3 = qualified, < 3 / -1 = below_bar, none = unassessed). `prospectStatusSchema` retired; `gateStatus` + `personTypeSchema` kept.
- Writes set the entry status, not a disposition: `approveSignal`, `qualifyProspect` (re-score no longer touches the pipeline position), `addManualLead` create people at the default pipeline's entry status (Cold).
- Reads: `loadActionableProspect` gates on the qualification read (not a status string); `listProspects` / `getProspectDetail` resolve `status` to the pipeline_status name and add a `qualification` field.
- Minimal status-setter UI on the prospect list (a `<select>` of the pipeline's statuses -> `setStatusAction`; a qualification badge distinct from the pipeline status; the filter uses the pipeline statuses). The kanban board is a follow-up.

**Out of scope (deferred):** the multi-pipeline UI (in v1 a single default pipeline is seeded, so the status-setter offers that pipeline's statuses to every person; per-pipeline status sets and pipeline reassignment are future work, ADR-0020 People-only v1). CRUD of pipelines/statuses by the operator is a follow-up. The `score` column shows the latest Scoring of any rubric kind, so for a peer (peer-rubric) it can sit beside a buyer-`unassessed` qualification by design.
