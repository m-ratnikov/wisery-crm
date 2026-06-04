## Why

The data model freezes every Prospect as signal-derived (`prospects.signal_id NOT NULL`, ADR-0005), but a CRM user often already knows a person they want in the pipeline - a referral, someone met at an event, a name from a call - with no upstream signal behind them. There is no way to put that person under evaluation today. This change shapes how a manually-entered lead enters the model without weakening the signal-to-prospect fan-out that the rest of the pipeline depends on.

## Scope

**In:**
- The Prospect entity's origin: a prospect may be **signal-derived** (the existing path) or **manual** (entered by the CRM user with no signal).
- The minimal identity a manual lead carries (name, and the few fields a person needs to be scored and acted on) and where that identity lives relative to the scraped path (`signals.payload`).
- The Prospect lifecycle entry point for a manual lead, and how qualify and the prospect/queue read-models treat a prospect that has no signal.
- The superseding decision (ADR-0010) and the canon it revises.

**Out:**
- The implementation - the Drizzle migration, the Add-lead form, the coalescing read seam, and the qualify-path handling are a separate `spec-driven` code change against this revised canon. No code or migration ships from this change.
- The signal-to-prospect fan-out cardinality itself (one signal still fans out to N prospects, ADR-0005) - this change does not touch it.
- Manual entry of companies/content or any expand path; a manual lead is a person.
- Multi-tenant, auth, dedup-across-origins.

## Views

- `use-cases`: Required - a new user-facing goal (the CRM user adds a known person to the pipeline by hand) crosses the system boundary.
- `domain-model`: Required - the Prospect entity gains an `origin`, `signal_id` becomes optional, and the lifecycle gains a manual entry point; this is squarely an entity-shape and lifecycle change.
- `system-design`: Skip - no container, boundary, or external-system change. Manual entry is a new web action into the existing app container that creates a Prospect and qualifies it by `prospectId`. This does add component-level (C4 L3) seams - a `PersonIdentity` read seam, a prospect-keyed qualify entry, left-joined read-models - but those are below this view's container altitude and are documented in the domain-model "Consumer impact" note and owned by the implementing code change, so the L1/L2 view itself does not change.
- `deployment`: Skip - where things run does not change; the additive migration is a consequence recorded for the code change, not a topology change.

## Quality attributes

- **Integrity (invariant preservation)**: a signal-derived prospect MUST still have its `signal_id` (the fan-out path is unweakened); only a manual-origin prospect may have none. The model must make "signal-derived but missing its signal" unrepresentable rather than merely discouraged.
- **Consistency (uniform identity)**: a prospect's person identity (name, headline/title, etc.) must be readable through one seam regardless of origin - scraped identity in `signals.payload`, manual identity in prospect columns - so qualify, the prospect list, and the queue have no per-origin branching beyond the read seam.
- **Backward compatibility**: every existing prospect is signal-derived; the change must be additive (a new nullable column plus an `origin` defaulting to signal-derived), never a rewrite of existing rows or the fan-out path.
- **Privacy**: a manual lead is third-party PII the CRM user enters first-hand; it carries the same posture as scraped PII (minimization at the qualify boundary, D10) - no new sub-processor, no new external egress.

## Impact on canon

- Overview sections (docs/product-overview.md): MVP scope (add manual lead entry as an in-scope entry path alongside signal sources); the "source types resolve to different entities" / pipeline note (a prospect may originate without a signal); the locked-decisions table - D5/ADR-0005 row gains a pointer to ADR-0010 (refines, does not reverse, the fan-out).
- System-wide views: glossary.md (the **Prospect** definition: "a person under evaluation, derived from a signal" -> "...derived from a signal or entered manually").
- Area views (docs/architecture/ - flat, single implicit area): domain-model.md (the Prospect entity: `origin`, nullable `signal_id`; the lifecycle's manual entry; the events table gains a ProspectAddedManually event; the cardinality note that a prospect is signal-derived or manual).
- ADRs: docs/adr/0010-prospect-origin-signal-or-manual.md - records the manual origin and supersedes ADR-0005's totality claim that every prospect derives from a signal (the `signal_id NOT NULL` stance), while preserving its one-signal-to-N-prospect fan-out.
