## Why

The product-overview scopes content marketing as deferred and leaves the intake gate as an open question - today a signal auto-fans-out into a prospect and the ICP score auto-gates it, with the only human gate at send. This change shapes the architecture for a second motion (engage ICP buyers and peers by commenting on their posts) and reframes intake around a universal triage inbox, demoting the ICP score from an auto-gate to an advisory hint. Provenance: docs/explore/2026-06-06-content-marketing-engagement.md (E1-E10).

## Scope

**In:**
- The intake reframe: universal triage (every signal awaits human approve/dismiss, no per-source bypass), and a `signal_decisions` table holding the mutable decision while `signals` stays immutable (D-C).
- The person model: rename `prospects` -> `person`, add `type` (prospect | peer) and a `monitored` flag (one identity, facets not separate tables).
- `companies` as a first-class entity (approving a company signal creates one).
- The engagement artifacts: `posts` (a person's activity, on-demand or scanned) and `comments` (per-post, AI-drafted, human-posted).
- Advisory, type-keyed filters: `rubric.kind` (icp | peer | company); the ICP score becomes advisory at triage; the durable per-person Scoring (ADR-0005) is still created at approval.
- Global comment tone/guidance as config-as-data.
- The surface model: one Queue (kind = triage | send) and a separate Feed.

**Out:**
- Any code, migration, or shipped behavior (this is architecture only).
- Chat-configured scanner (T6), bridge-finding connection graph, and a comment -> outcome learning loop - all deferred.
- Multi-tenant plumbing (unchanged, product-overview section 7).
- Auto-commenting and auto-sending (forbidden by D2, not in scope to revisit).

## Views

- `use-cases`: Required - the slice is user-facing (triage, feed, comment, fetch-posts are CRM-user goals).
- `domain-model`: Required - this is the load-bearing view; the person rename, the fan-out timing, and the new entities are all entity-shape changes.
- `system-design`: Required - intake boundaries shift (the triage gate, advisory filters) and the Feed/Queue runtime flows are new.
- `deployment`: Skip - where-things-run is unchanged (same web app + in-process pg-boss + Postgres + Apify/LLM, ADR-0001/0002/0004).

## Quality attributes

- **Security/privacy**: third-party PII (posts, profiles) enters the system; it stays server-side behind the same boundary as dossiers, and no content is published automatically (D2 - human posts every comment).
- **Cost**: post fetch and comment generation are user-triggered or scan-bounded, never an automatic per-signal stage - the cost gate stays explicit (consistent with ADR-0007).
- **Correctness/durability**: a human triage decision must survive re-scans - the scanner re-encounters the same deduped signal every run and must never reset a dismissal (the driver behind the separate `signal_decisions` table).

## Impact on canon

- Overview sections (docs/product-overview.md): locked-decisions table - add a new D-entry for universal triage ("every signal awaits human approve/dismiss at intake; no per-source bypass") and mark D5's auto-gate-at-score clause refined (the ICP score is now advisory at triage; the durable per-person Scoring is still created after approval); the pipeline diagram (insert the triage gate + advisory filter + the engagement loop); MVP scope (move content marketing from Deferred to In for this slice); open questions (close the intake-gate question); the Canonical nouns paragraph (Person, Company, Post, Comment, SignalDecision, Comment guidance); and the anchor-view roster (the prior "review/approve queue" becomes the two-lane Queue surface, triage + send).
- System-wide views: docs/architecture/glossary.md (new/renamed nouns); docs/architecture/domain-model.md - the canonical Domain Events table (`SignalPersisted` no longer creates an entity or enqueues qualify; add the new engagement events) and the prospect Lifecycle diagram (the entry `[*] --> New` moves from `SignalPersisted` to `SignalApproved` for signal-origin people; manual-origin entry unchanged); docs/architecture/system-context.md (no new external system - confirm); docs/architecture/cross-cutting.md (PII flow note for posts/comments).
- Area views (docs/architecture/areas/<area>/): a `signals` (or `pipeline`) area gets the triage + advisory-filter domain-model and runtime flow; an `engagement` area gets the posts/comments/feed domain-model and runtime flow. Create folders as needed.
- ADRs: ADR-0013 (universal triage + advisory filter, no auto-fan-out bypass) and ADR-0017 (type-keyed advisory rubrics) carry `Refines: ADR-0005` - ADR-0013 refines its fan-out trigger/timing, ADR-0017 its rubric scope (one-active-per-kind); ADR-0005's one-to-many cardinality, per-person Scoring, and rubric-version binding are preserved, and ADR-0008 is untouched. ADR-0016 makes company a first-class entity; ADR-0015 renames `prospects`->`person` with `type`/`monitored`; ADR-0018 adds engagement artifacts (posts/comments, human-posted, extends D2). `signal_decisions` is additive (documented in ADR-0014). A one-line forward note is added to the immutable docs/adr/0005, 0008, and 0010 pointing to the refining/renaming ADRs - an additive annotation, not an edit to their decisions.
