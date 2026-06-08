# Explore: Content marketing - the engagement motion and a universal triage inbox

- Date: 2026-06-06
- Decision: distilled into ADR-0013..0018 (accepted 2026-06-07) via the `content-marketing-engagement` spec-driven-architecture change. Auto-fan-out was dropped during distillation (see Refinement in Outcome below).
- Method: spec-kit (clarify + research), adapted

## Question

How do we add a "content marketing" capability - regularly commenting on meaningful
posts from ICP buyers and from peers/amplifiers who reach the ICP - on top of the
existing outreach funnel, without bolting on a parallel mechanism? The raw ask bundled:
AI commenting on posts, monitoring for new connections, activity monitoring of a target
lead set, a configurable feed of leads' posts, posting activity on the prospect card
(on explicit request), an agent-configured search scanner feeding a queue, a
spy/monitoring flag, and a feed-detail screen with AI comment generation.

## Assumptions and constraints

- Reuse before build (CLAUDE.md). The existing system already has: configurable
  `Source`/`Connector` (D4), `signals` (immutable deduped facts, D-C), `prospects`
  (origin signal|manual, ADR-0010), the `rubric`/`userProfile` config-as-data, the
  per-person `Scoring` (ADR-0005), regenerable `drafts` (ADR-0007/0008), `dossiers`,
  the on-demand enrichment pattern (ADR-0007), the `LLMProvider` port (ADR-0003), the
  `jobs` pg-boss facade (ADR-0004), and a wired review/approve queue.
- D2 holds: automate the intelligence, the channel action stays human. No auto-sending,
  no auto-commenting.
- Drizzle migrations are immutable once applied; new shape = new migration.

## Clarifications (Q&A from the clarify pass)

- T1 spy/monitoring: a **flag on the same person**, not a separate entity. One person
  can be both an outreach target and monitored.
- T4 posting activity: a **separate entity** attached to a person, independent of
  signals; can be created with no signal (open a person, click "get latest posts").
- T5 comments: AI **drafts**, human posts (consistent with D2). No auto-commenting.
- T6 chat-configured scanner: **deferred** for v1; source config stays form/wizard.
- 2a buyer vs peer/amplifier: peers **skip the ICP qualifier**. The comment prompt =
  full person info + a **global** tone/guidance setting. No per-person strategy field
  in v1.
- 2b "monitor for new connections": just the existing signal stream **widened** to
  surface buyers, peers, and standalone content worth engaging - not only people. The
  bridge-finding graph (discover who is connected to the ICP) is the heavy reading and
  is deferred.
- T3 queues: **unify** triage and review behind one Queue surface with a `kind`
  discriminator (triage | send); the Feed stays a separate browse surface; comments
  live inline in the Feed, not routed through the Queue.
- Signal immutability: keep `signals` append-only (D-C). The triage decision is mutable
  and lives in a separate table so the scanner (which re-encounters the same deduped
  rows every run) can never clobber a human decision.

## Unknowns (resolved)

- NC1 leads-vs-contacts modeling -> resolved: one person table + `type` facet.
- NC2 where the triage decision lives -> resolved: separate `signal_decisions` table.
- NC3 auto-fan-out granularity -> resolved: per-source flag.
- NC4 does comment generation need buyer/peer strategy -> resolved: no, one prompt +
  global guidance.
- NC5 standalone content with no tracked person -> resolved: approve creates the
  author as `person(type=peer)` + attaches the post.

## Options considered

**Leads vs contacts (NC1).**
- A: one person table + `type` facet (prospect | peer), `monitored` flag. Chosen.
  - Pros: consistent with T1 (one identity, facets not tables); one person-360 detail
    screen; lead->contact is a field flip, not a row migration; no HubSpot-style
    dedup across two tables for a person who is both a buyer and an engaged peer.
  - Cons: the `prospects` table name becomes a misnomer once it holds peers -> rename
    to `person`.
- B: separate `leads` and `contacts` tables (HubSpot). Rejected: a person who is both
  duplicates identity; the detail screen must UNION two tables; contradicts T1.

**Where the triage decision lives (NC2).**
- A: separate `signal_decisions` table. Chosen.
  - Pros: keeps `signals` immutable (D-C preserved, additive not superseding); the scan
    writer and the triage writer never share a row, so re-scans (dedup re-encounter the
    same signal every run) cannot reset a dismissal; room for decision history later.
  - Cons: a LEFT JOIN for the inbox query; one extra table.
- B: a mutable `status` column on `signals`. Rejected (close call).
  - Under universal triage the fan-out objection mostly evaporates (each signal -> one
    approve decision at triage; company->N people is a later step), so it is mechanically
    viable with ON CONFLICT DO NOTHING. Rejected for the re-scan-clobber risk (two
    writers on one hot row) and because it would supersede the accepted D-C invariant.

**Queue surfaces (T3).**
- Chosen: one Queue surface, `kind` ∈ {triage, send}; Feed separate; comments inline in
  the Feed. Triage = low-stakes intake (accept/reject a discovery); send = high-stakes
  approve-and-send a DM. The `kind` keeps them visually/functionally separate within one
  nav item. Comments stay in the Feed because the post is their context.
- Rejected: three separate surfaces (over-fragmented); one flat undifferentiated list
  (mixes high- and low-stakes actions, invites error/fatigue).

**Intake gate (the load-bearing reframe).**
- Chosen: **universal triage** - all signals wait in the inbox for human approve/dismiss;
  the ICP score is demoted from an auto-gate to an **advisory** hint shown at triage.
  Auto-fan-out (today's behavior) stays available as a **per-source** opt-in flag (like
  `auto_enrich`). This reworks the shipped intake rather than adding alongside it.
- Rejected: triage only for new noisy sources (leaves two intake paths; less coherent).

## Key findings (grounded in the current system)

- `signalKind` already includes `content`, so surfacing posts/links is mostly new
  *sources*, not a new mechanism (schema.ts:40).
- The filters-by-signal-type idea maps onto the existing `rubric` table: add a `kind`
  (icp | peer | company) and "run the rubric matching this signal's intent." Reuse,
  not a new mechanism.
- The "get latest posts" action is the existing on-demand enrichment pattern (ADR-0007)
  applied to a posts entity - a user-triggered Apify/connector job, not an auto stage.
- Comments are the `drafts` *pattern* (LLMProvider, versioned prompt, regenerable) but a
  *different rule*: many per person, keyed to a post - so a separate `comments` table,
  not the `drafts` table (whose one-selected-per-prospect index is wrong for comments).
- ADR-0005 (score per person) is preserved: the triage advisory hint is computed on the
  signal to help the decision; the durable per-person `Scoring` is still created at
  approval. The advisory hint is not the persisted Scoring.

## Outcome

> Refinement (2026-06-07): during distillation, **auto-fan-out was dropped entirely**. E2
> (per-source `auto_fanout` opt-in) and NC3 (its granularity) are superseded - triage is now
> unconditional, with no per-source bypass. Keeping a bypass would reintroduce the auto-fill the
> reframe exists to prevent and split intake into two paths. The `sources.auto_fanout` schema
> delta below is therefore not added. The rest of E1-E10 stands.

Locked decisions (E1-E10):

| # | Decision |
|---|----------|
| E1 | Universal triage: all signals land in an inbox; human approves/dismisses. |
| E2 | ~~Auto-fan-out optional, **per-source** (a boolean on `sources`), like `auto_enrich`.~~ Superseded 2026-06-07: auto-fan-out dropped, triage is unconditional (see Refinement above). |
| E3 | One person table; `type` (prospect\|peer) + `monitored` flag; **rename `prospects` -> `person`**. |
| E4 | Company is a first-class entity (`companies`). |
| E5 | Approve standalone content -> author as `person(type=peer)` + attached post. |
| E6 | `posts` entity on a person; on-demand fetch or activity scan. |
| E7 | `comments` per-post artifact; AI drafts, human posts. |
| E8 | Advisory, type-keyed filters via `rubric.kind` (icp\|peer\|company); never auto-gate. |
| E9 | Comment tone/guidance = global config-as-data. |
| E10 | Triage decisions in a separate `signal_decisions` table; `signals` stays immutable. |

Deferred: chat-configured scanner (T6); bridge-finding connection graph (2b heavy
reading); comment -> outcome learning loop (a D7-style engagement loop).

Schema deltas: `prospects` -> `person` + `type` +
`monitored`; `rubric` + `kind`; `settings` + comment guidance; new `companies`,
`posts`, `comments`, `signal_decisions`. (The `sources` + `auto_fanout` delta was
dropped per the 2026-06-07 refinement.)

Surfaces: one **Queue** (kind = triage | send); a separate **Feed** (monitored people's
posts, draft+post comments inline); the **person detail** gains on-demand posts +
activity + comment history; **config** gains comment guidance and the peer rubric.

Code slices (after the architecture is ratified): (1) posts + "get latest posts" on the
person card; (2) monitored flag + Feed + activity scan; (3) AI comment generation +
global guidance; (4) universal triage inbox + company entity +
content->peer routing + peer rubric/type. Slices 1-3 are additive; slice 4 is the
invasive reframe and carries the superseding ADRs.

Next step: way #1 - a single `spec-driven-architecture` change distills these into the
superseding ADRs first (universal-triage + advisory-filter; company entity; type-keyed
filters + person rename + engagement artifacts), reworking the domain model and pipeline
canon before any code change. ADRs that this will likely supersede/refine: ADR-0005
(fan-out timing), ADR-0008 (status), ADR-0010 (origin relates), and the
product-overview pipeline + open questions.

## Sources

- docs/product-overview.md (pipeline, locked decisions D1-D10, MVP scope, open questions)
- src/lib/db/schema.ts (D-A..D-G conventions; signals immutability D-C; rubric; prospects)
- docs/adr/0005, 0007, 0008, 0010; ADR-0002/0003/0004 (ports and facade)
- src/lib/qualify/status.ts (the disposition vocabulary, ADR-0008)
- src/app/prototype/README.md (the screen <-> capability join table)
