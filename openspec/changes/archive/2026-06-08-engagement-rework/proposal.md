## Why

The content-marketing change (ADR-0013..0018) shipped three shapes the product owner rejected on review: drafting as an automatic pipeline stage feeding a separate Review & approve queue, a Triage surface split from that queue, and a fixed Person-status enum (ADR-0008). The owner's model is the opposite - message generation is an on-demand action on the Person, there is one unified Queue (the signals inbox), and Person status is a configurable pipeline (Breakcold-style kanban), not a fixed vocabulary. This change re-cuts the post-intake engagement architecture to that model without bolting on parallel mechanisms. Provenance: docs/explore/2026-06-08-engagement-rework-queue-pipelines-messages.md.

## Scope

**In:**
- Remove the drafting stage (worker, prompt, qualify -> draft handoff, the `queued` status, the Review & approve queue surface); record generation as an on-demand, synchronous Person action.
- Unify intake: one Queue (the `/triage` read becomes the sole inbox); fold away the separate `/review-queue` route.
- Configurable pipelines for Person status: `Person.status` becomes a FK to a seeded, CRUD-able `pipeline_status`, superseding the fixed enum (ADR-0008).
- The LinkedIn `Message` entity (connection-request as a message type), generated on demand alongside the existing post-linked `Comment`.
- Scoring and enrichment become on-demand Person actions; approval promotes the signal's advisory score into the person's `advisory`-provenance initial assessment Scoring (no LLM), manual entry no longer auto-scores, the durable qualify-prospect worker is retired, and qualification is a read over the latest Scoring.

**Out:**
- Cross-source identity resolution (still deferred, ADR-0005).
- Channel discriminator vs per-channel table (NC1 - deferred; v1 ships LinkedIn-only Message + Comment).
- Company / Deal pipelines (pipelines scope to People only in v1).
- The kanban board UI build (v1 ships a status-setter; board is a follow-up).
- Comment/Message-to-outcome learning loop (still deferred, ADR-0018).
- Manual entry no longer auto-scores (owner directive, revising NC2): a hand-created person starts unscored and is scored only on demand. Queue-created people instead keep an `advisory`-provenance initial assessment Scoring promoted at approval. With no auto-score path left, the durable `qualify-prospect` worker is retired.

## Views

- `use-cases`: Required - the user-facing surfaces change (unified Queue, the Person workspace, pipeline-status management).
- `domain-model`: Required - new entities (`pipeline`, `pipeline_status`, `Message`), `Person.status` becomes a FK, and the Person lifecycle stops being a fixed line.
- `system-design`: Required - the drafting stage is removed, two surfaces merge into one, and post-intake work becomes on-demand actions; runtime flows change.
- `deployment`: Skip - where-things-run is unchanged (in-process pg-boss, managed Postgres, ADR-0001/0004); no topology decision here.

## Quality attributes

- **Cost control**: LLM and Apify spend happens only on an explicit user action on the Person; approval makes no LLM call (it promotes the already-computed advisory score into the person's initial Scoring) and manual entry does not auto-score. Refines ADR-0007's opt-in-spend attribute and extends it to scoring and generation.
- **Data preservation**: the `Person.status` enum -> FK change is additive-then-swap (add column, backfill, swap), no data loss; existing migrations stay immutable (a rename, if any, is hand-authored `ALTER ... RENAME` + reconciled snapshot/journal).
- **Anti-strand intake**: the Queue read stays a LEFT JOIN on `signal_advisory` / `signal_decisions`; a decided item drops out; because approval no longer enqueues a downstream job, no committed approval can be stranded waiting on one (the ADR-0009 handoff invariant is satisfied vacuously). Preserves the system-review 2026-06-07 invariant.

## Impact on canon

- Overview sections (docs/product-overview.md): the **Locked decisions** table (D5 and D11 reworded for on-demand scoring + the unified Queue; rows added for ADR-0019/0020/0021; the D-row citing ADR-0008 marked superseded by ADR-0020; the D5/auto-enrich content citing ADR-0007 and the advisory/Scoring content citing ADR-0017, and the post-approval qualify-enqueue content citing ADR-0013, all annotated as partially superseded by ADR-0019); section 4 **Pipeline architecture** diagram (remove the DRAFT and SEND QUEUE stages; the Queue is the sole intake; add the Person workspace with on-demand actions and the configurable pipeline); section 8 **MVP scope**; section 9 **Open questions** (close the status-model and intake-surface questions, open the channel-discriminator question NC1). The **Primary journey** is revised (no drafting step; on-demand generation; pipeline status).
- System-wide views: docs/architecture/glossary.md (add Pipeline, Pipeline status, Message, Message type; revise/remove Draft; revise Queue and Person lifecycle terms); docs/architecture/cross-cutting.md (data-sensitivity note: Message bodies are server-side PII behind the same boundary as Comment/Dossier). docs/architecture/system-context.md externals are unchanged (one note that Triage + Review collapse to one Queue surface).
- Area views (flat canon, single implicit area): docs/architecture/domain-model.md (Entity model + Lifecycle + Domain events) and docs/architecture/system-design.md (Containers, Key runtime flows, Components C4 L3) are re-sliced from this change's views.
- ADRs: **0019** Generation and scoring are on-demand Person actions, not auto pipeline stages (supersedes in part ADR-0013 [the post-approval qualify enqueue], ADR-0007 [the auto-enrich-on-qualify setting], ADR-0017 [the "only qualify persists a Scoring" mechanism - purpose preserved via the advisory provenance exclusion], and ADR-0010 [the manual-prospect auto-score]; refines ADR-0005, ADR-0018; adds a `scorings.provenance` column); **0020** Configurable pipelines for Person status (supersedes ADR-0008); **0021** LinkedIn Message entity, connection-request as a message type (refines ADR-0018, records NC1 channel-discriminator deferral).
