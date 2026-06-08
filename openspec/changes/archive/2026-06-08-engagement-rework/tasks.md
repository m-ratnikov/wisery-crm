> Promotion is an atomic batch: tasks 1.1 through 4.2 must all complete and pass the section-0 gate before this change is archived and before any Phase 2 code is written. A partial promotion (e.g. ADRs without the spine reconcile) would leave docs/product-overview.md citing the superseded qualify/draft/review-queue pipeline while the new ADRs are in force - a self-contradictory canon.

## 0. Cross-view consistency check

- [x] 0.1 Every domain event in domain-model.md maps to a lifecycle transition or an on-demand action (SignalApproved/Dismissed -> Queue exit, PersonStatusChanged -> a pipeline transition, MessageGenerated/CommentGenerated/PersonRescored/PersonEnriched -> on-demand actions that do not move status), and the removed events (DraftGenerated, PersonQueued) appear nowhere in the promoted canon.
- [x] 0.2 Every use case (UC1-UC4) traces to at least one entity in domain-model.md (Queue -> Signal/SignalDecision/SignalAdvisory; workspace -> Person/Message/Comment/Scoring/Dossier; pipeline -> Pipeline/PipelineStatus).
- [x] 0.3 Every container in system-design.md (web app, in-process workers, Postgres) and every external in the C4 L1 appears consistently across system-context.md and system-design.md; the removed `draft` worker appears in neither.
- [x] 0.4 Verification gate: /verify-gate has passed for each promoted view (use-cases, domain-model, system-design) and each ADR (0019, 0020, 0021) - groundedness ledger has no unsupported claims, Chair verdict is not "rework", the record's `git hash-object` matches current content, and human sign-off is recorded for the three ADRs (the agent must not self-sign). See docs/verification-gate.md.
- [x] 0.5 Mechanical checks: `npm test` passes (tests/mermaid.test.ts runs `mermaid.parse` over every diagram in the change and docs; tests/arch-links.test.ts resolves links) - a diagram that does not parse blocks promotion.

## 1. Reconcile the spine (docs/product-overview.md)

- [x] 1.1 Locked decisions table: reword D5 (durable Scoring is on-demand, not auto on approval; approval writes no Scoring) and D11 (one unified Queue, the Review & approve queue removed); add a row each for ADR-0019, ADR-0020, ADR-0021; mark the D-row that cites ADR-0008 as superseded by ADR-0020; annotate the ADR-0007 auto-enrich-on-qualify content and the ADR-0013 post-approval qualify-enqueue content as partially superseded by ADR-0019.
- [x] 1.2 Section 4 Pipeline architecture diagram: remove the DRAFT and SEND QUEUE stages; show the Queue as the sole intake, the Person workspace with on-demand actions (generate message, generate comment, re-score, enrich), and the configurable pipeline status.
- [x] 1.3 Primary journey: remove the drafting step; reflect on-demand generation and setting pipeline status (mirror use-cases.md Primary journey).
- [x] 1.4 Section 8 MVP scope and section 9 Open questions: close the status-model question and the intake-surface question; open the channel-discriminator question (NC1, ADR-0021).

## 2. Distribute the views by scope (flat canon, single implicit area)

- [x] 2.1 Promote domain-model.md Entity model + Lifecycle + Domain events into docs/architecture/domain-model.md: add Pipeline / PipelineStatus / Message; change Person.status to a PipelineStatus FK; replace the fixed Person lifecycle with the configurable-pipeline lifecycle; remove the Draft entity and the DraftGenerated/PersonQueued events. Strip all `<!-- v:... -->` anchors.
- [x] 2.2 Merge glossary terms into docs/architecture/glossary.md: add Queue, Pipeline, Pipeline status, Message, Message type, On-demand action; revise the Person-status/lifecycle terms; remove or mark Draft as retired.
- [x] 2.3 Promote system-design.md C4 L1 into docs/architecture/system-context.md (externals unchanged; note Triage + Review collapsed to one Queue). Strip anchors.
- [x] 2.4 Promote system-design.md Containers + Components (C4 L3) + Key runtime flows into docs/architecture/system-design.md: remove the draft worker/handler/core and the qualify->draft handoff; add the Message generator and pipeline module; replace the intelligence-pipeline and human-review flows with the approve-from-Queue and on-demand-generation flows. Strip anchors.
- [x] 2.5 Promote system-design.md Cross-cutting notes into docs/architecture/cross-cutting.md (Message PII under Data sensitivity; on-demand synchronous failure handling). Strip anchors.

## 3. Promote ADRs

- [x] 3.1 Move adr/0019-generation-and-scoring-on-demand.md to docs/adr/0019-*.md (reconfirm the next free sequence against docs/adr/), set Status to accepted with the recorded sign-off date, and cross-link from the spine. Immutable once accepted.
- [x] 3.2 Move adr/0020-configurable-pipelines-for-person-status.md to docs/adr/0020-*.md; set Status accepted; its Supersedes points at ADR-0008. Cross-link; do not edit ADR-0008 (immutable) - it is reached via the Supersedes link.
- [x] 3.3 Move adr/0021-linkedin-message-entity.md to docs/adr/0021-*.md; set Status accepted; cross-link. Records NC1.

## 4. Cross-link

- [x] 4.1 Link the overview locked-decisions rows to ADR-0019/0020/0021; link docs/architecture/domain-model.md and system-design.md sections to the governing ADRs; ensure any canon reference to the primary journey or personas resolves within canon, not into the archived change.
- [x] 4.2 Verify canon integrity: `npm run verify` (tests/canon-integrity.test.ts against docs/architecture/canon.manifest.json) passes - required sections present, no dangling references to archive-only artifacts, all canon links and intra-canon anchors resolve, and no leaked `<!-- v:... -->` anchors.
