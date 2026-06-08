## 0. Cross-view consistency check

- [x] 0.1 Every domain event in domain-model.md maps to a lifecycle transition (signal-triage or comment) or a documented job stage; SignalApproved/SignalDismissed line up with the SignalDecision states.
- [x] 0.2 Every use case (UC1-UC6) traces to at least one entity in domain-model.md (triage -> SignalDecision; approve -> Person/Company/Post; monitor -> Person.monitored; fetch -> Post; comment -> Comment).
- [x] 0.3 Every runtime flow participant in system-design.md exists as a container/component or external system; no new container or port was introduced (confirm against canonical system-design.md).
- [x] 0.4 Verification gate: /verify-gate has passed for each promoted view (use-cases, domain-model, system-design) and each ADR (0013-0018) - groundedness ledger has no unsupported claims, Chair verdict is not "rework", the record's git hash-object matches current content, and a human sign-off is recorded for every ADR before promotion (the agent must not self-sign). See docs/verification-gate.md.
- [x] 0.5 Confirm the ADR headers match the supersession ruling: ADR-0013 and ADR-0017 carry `Refines: ADR-0005` (fan-out trigger/timing and rubric scope respectively; ADR-0005's one-to-many cardinality, per-person Scoring, and rubric-version binding are preserved); ADR-0014/0015/0016/0018 are additive (`Supersedes: none`). No ADR sets `Supersedes` (a full replacement). ADR-0005/0008/0010 and D-C stay in force unedited (no forward note - per repo precedent the refine/rename relationship is recorded in the new ADRs, not by editing the immutable ones; task 4.5).
- [x] 0.6 Mechanical checks green: `npm test` (tests/mermaid.test.ts runs `mermaid.parse` over every diagram in the change + docs; tests/arch-links.test.ts checks links) passes - a diagram that does not parse blocks promotion (docs/verification-gate.md, Mechanical checks). Note: `openspec validate` is schema-agnostic and false-errors with "no deltas" on every spec-driven-architecture change - it is NOT the gate here, do not block on it.

## 1. Reconcile the spine (docs/product-overview.md)

- [x] 1.1 Locked decisions table: add a new D-entry for universal triage with no auto-fan-out bypass (ADR-0013) and mark D5's auto-gate clause refined (the score is now advisory at triage, the durable Scoring still created after approval); add rows for SignalDecision/immutable signals (ADR-0014), Prospect->Person + type/monitored (ADR-0015), Company entity (ADR-0016), type-keyed rubrics (ADR-0017), engagement artifacts (ADR-0018).
- [x] 1.2 Pipeline architecture diagram: insert the triage gate + advisory filter before entity creation (every signal routes through it - no bypass), and add the engagement loop (monitor -> posts -> Feed -> comment, human-posted).
- [x] 1.3 MVP scope: move content marketing / the engagement motion from Deferred to In for this slice; keep chat-config scanner, bridge-finding graph, and comment-outcome loop in Deferred.
- [x] 1.4 Open questions: close the intake-gate question (resolved by ADR-0013).
- [x] 1.5 Canonical nouns paragraph: add Person (renamed), Company, Post, Comment, SignalDecision; update the Prospect reference to Person.
- [x] 1.6 Personas / Primary journey: re-slice the engagement primary journey from use-cases.md into the Primary journey section (alongside the existing outreach loop); add the Engagement target recipient note to Personas. Ensure these resolve within canon (not pointing at the archived use-cases).

## 2. Distribute the views by scope (flat canon - no areas yet)

Promotion re-slices by scope into the existing flat files (the canon is still a single implicit area per README rule 5 and canon.manifest.json pins flat paths). Strip all `<!-- v:... -->` anchors during promotion.

- [x] 2.1 Glossary (docs/architecture/glossary.md): add Person, Person type, Monitored, Company, Post, Comment, Comment guidance, SignalDecision, Rubric kind; update Signal (no longer auto-fans-out - always awaits triage) and replace the Prospect entry with Person.
- [x] 2.2 Domain model (docs/architecture/domain-model.md): merge the new entities (SignalDecision, Company, Post, Comment, CommentGuidance) and the Person rename + type/monitored + company_id into the Entity model ERD and the per-cardinality notes; add the signal-triage and comment lifecycles; append the new domain events; change the existing `SignalPersisted` events row so it no longer creates an entity or enqueues qualify, and move the prospect Lifecycle entry `[*] --> New` from `SignalPersisted` to `SignalApproved` for signal-origin people (manual-origin entry unchanged); generalize the rubric single-active constraint to one-active-per-kind; update the "Not modeled yet" note (Company is now modeled; expansion still deferred).
- [x] 2.3 System design (docs/architecture/system-design.md): add the two runtime flows (scan-to-triage, monitor/fetch/comment) to Key runtime flows; add the L3 component deltas (Queue, Feed, person-detail action; advisory-filter, activity-scan, fetch-posts handlers/cores; comment-generation as a synchronous server-action core, not a queue handler; comment prompt) to the Components (C4 L3) section and the component catalog; note that containers are unchanged.
- [x] 2.4 System context (docs/architecture/system-context.md): confirm no new external system; add the engagement-target recipient edge to the boundary runtime flow if the slice's manual-post action belongs there.
- [x] 2.5 Cross-cutting (docs/architecture/cross-cutting.md): add the PII-flow note for posts/comments (server-side, same boundary as dossiers, no auto-publish) and the new-jobs observability note (advisory-filter, activity-scan, fetch-posts in the jobs monitor; comment generation is a synchronous action, observed via request logging, not the jobs monitor).

## 3. Promote ADRs

- [x] 3.1 Reconfirm the next free 4-digit sequence against docs/adr/ (highest is currently 0012; this change drafts 0013-0018 - renumber consistently if another change landed first).
- [x] 3.2 Move adr/0013-universal-triage-intake.md -> docs/adr/0013-*.md, set Status accepted (only after human sign-off), and cross-link from the spine. Immutable once accepted.
- [x] 3.3 Move adr/0014-signal-decision-separate-from-signal.md -> docs/adr/0014-*.md (accepted, cross-link).
- [x] 3.4 Move adr/0015-prospect-to-person-with-type.md -> docs/adr/0015-*.md (accepted, cross-link).
- [x] 3.5 Move adr/0016-company-first-class-entity.md -> docs/adr/0016-*.md (accepted, cross-link).
- [x] 3.6 Move adr/0017-type-keyed-advisory-rubrics.md -> docs/adr/0017-*.md (accepted, cross-link).
- [x] 3.7 Move adr/0018-engagement-artifacts-post-comment.md -> docs/adr/0018-*.md (accepted, cross-link).

## 4. Cross-link

- [x] 4.1 Link the new product-overview locked-decisions rows to their ADRs and to the domain-model/system-design sections.
- [x] 4.2 Link domain-model.md and system-design.md to ADR-0013..0018 in their governing-decisions headers.
- [x] 4.3 Add a docs/explore/2026-06-06-content-marketing-engagement.md backlink to each promoted ADR's Source (already set) and from the explore note's Decision header to the promoted ADRs.
- [x] 4.4 Update the prototype registry (src/app/prototype/README.md) join table when the Queue (triage lane) and Feed screens are added, per the prototype convention.
- [x] 4.5 Do NOT edit the immutable docs/adr/0005, 0008, 0010 (repo precedent: when ADR-0010 superseded ADR-0005 it left ADR-0005 unedited, recording the relationship only in the new ADR). The refine/rename relationships live in the new ADRs: 0013/0017 carry `Refines: ADR-0005` in their headers, and 0015 records the Prospect->Person rename in its text. Confirm ADR-0005's cardinality reads as in-force via those headers (ADR-0010's own body already scopes its `Supersedes: ADR-0005` to the totality clause, so no forward note is needed).

## 5. Verify canon integrity

- [x] 5.1 Run `npm run verify` (includes tests/canon-integrity.test.ts against docs/architecture/canon.manifest.json): required sections present, no dangling references to archive-only artifacts, all canon links and intra-canon anchors resolve, and no leaked `<!-- v:... -->` anchors. Fix the canon, not the test, on a red check.
