# ADR-0015: Rename Prospect to Person; add type and monitored facets

- Status: accepted
- Date: 2026-06-06
- Supersedes: none
- Source: docs/explore/2026-06-06-content-marketing-engagement.md; domain-model.md

## Context

The `Prospect` entity is defined as "a person under evaluation". The engagement motion tracks people the CRM user is not evaluating as buyers - peers/amplifiers engaged via comments to reach the ICP. A person can be both an outreach target and an engaged amplifier, and the spy/monitoring marker was decided as a flag on the same person, not a separate entity. Modeling leads and contacts (or peers) as separate tables would duplicate one human across rows and force the person-360 detail to union tables - the dilemma resolved in favor of one identity with facets.

## Decision

We will rename the `Prospect` entity and `prospects` table to `Person`/`person`, and add two facet columns: `type` (text + Zod: `prospect` | `peer`, default `prospect`) and `monitored` (boolean, default false). `type` records why the person is tracked - `prospect` flows through the existing qualify -> draft -> send funnel; `peer` is engaged via comments, scored against the peer rubric rather than the ICP rubric (ADR-0017), and not run through the outreach draft/send funnel. `monitored` marks a person whose posts appear in the Feed and is independent of `type` - a prospect or a peer may be monitored. `origin` (ADR-0010) and `status` (ADR-0008) are unchanged and orthogonal to the new facets; the additive defaults mean every existing row reads as `type = prospect`, `monitored = false` with no backfill.

## Consequences

Easier: one identity holds both outreach and engagement facets, so the person-360 detail reads one row and lead-to-contact or prospect-to-peer is a field change, not a row migration. Harder/accepted: the rename touches the table, every existing FK referencing it (scorings, drafts, dossiers, outcomes), and the ubiquitous-language docs (glossary "Prospect" becomes "Person"); the new engagement tables (posts, comments) are authored against `person` from the start, so they add no rename churn. The implementing code change owns that churn. The narrower "Prospect = a person under evaluation" framing is widened, not reversed - ADR-0008 and ADR-0010 stay in force and continue to govern status and origin for `type = prospect` people; because those ADRs are immutable, their references to `Prospect`/`prospects` read as `Person`/`person` after this rename; following the precedent set when ADR-0010 superseded ADR-0005 (the in-force ADR was left unedited), the rename relationship is recorded in this ADR rather than by editing ADR-0008/ADR-0010. Peers (`type = peer`) are scored against the peer rubric, not the ICP rubric, and do not enter the outreach draft/send funnel - their score drives engagement filtering, not a first touch.
