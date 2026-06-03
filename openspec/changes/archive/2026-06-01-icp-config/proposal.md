## Why

The qualifier (Wave 3) scores each prospect against the ICP rubric and drafts in the user's voice - both must be **config-as-data the engine reads, never hardcoded** (D6, D1, the one multi-tenant discipline kept now). The data layer has Sources/Scans/Signals but no rubric or profile, and the config screen exists only as a clickable prototype. This change persists the ICP rubric and user profile as versioned config-as-data and graduates the prototype's config screen into the first wired anchor view, so a user configures the engine and a scan can be triggered from real data.

## What Changes

- **Two data tables** (migration 2, the schema conventions set by `signal-ingestion`): `rubric` (the ICP scoring criteria as JSONB, `name`, integer `version`, `active`, timestamps) and `user_profile` (positioning/offer/voice/case-studies as JSONB, `version`, timestamps). Modeled in `docs/architecture/domain-model.md`.
- **A config-as-data module** (`src/lib/icp/`): Zod schemas for the rubric and profile JSON shapes (mirroring the prototype/domain model), plus read/write functions - `getActiveRubric()`, `getUserProfile()`, `saveRubric()`, `saveUserProfile()`. Editing is **additive-versioned**: a save inserts a new version row and flips `active`, so a past Scoring's rubric is never rewritten (the invariant the learning loop depends on; a Rubric is immutable once any Scoring references it - domain-model).
- **A starter seed**: an idempotent `seedIcpConfig()` that inserts an initial active rubric + profile (the fractional-CTO ICP from the prototype, itself ported from `job-monitor`'s `ICP_SYSTEM_PROMPT`) if none exists, so the qualifier has something to score against without waiting on hand-entry (resolves the roadmap open question "whether icp-config's UI lags a seeded config").
- **Anchor view #1, wired**: the prototype's `icp-config` screen (rubric / profile / sources tabs) becomes a real Server Component reading live data, with **Server Actions** (`'use server'`) saving edits and revalidating. The Sources tab reads live `sources` (from `signal-ingestion`), toggles `enabled`, and triggers a scan via `enqueueScan` - real source kinds light up as `source-adapters` lands (only the fixture connector is registered today).
- The first non-prototype application route under `src/app/` (e.g. `/icp-config` or an app route group); the prototype screen remains as the design reference.

Not in scope: qualification/scoring (Wave 3, the rubric's consumer); concrete source connectors (`source-adapters`); auth on the Server Actions (D1 defers auth - the app is single-user; actions are documented as unauthenticated-by-design with the data-security caveat noted); multi-tenant `tenant_id` (D1).

## Capabilities

### New Capabilities
- `icp-config`: the ICP rubric and user profile persisted as versioned config-as-data the engine reads; an active rubric selectable at any time; edits are additive new versions so a referenced rubric is never rewritten; a starter configuration seeded so the pipeline can run before hand-entry; the wired config anchor view where a user edits the rubric and profile and manages and scans sources.

### Modified Capabilities
<!-- None. Reuses signal-ingestion's sources table + enqueueScan and platform-runtime's db/config without changing their contracts. -->

## Impact

- **Schema / migrations**: `src/lib/db/schema.ts` gains `rubric` + `user_profile`; migration 2 generated into `./drizzle` (immutable; ordered after migration 1).
- **New code**: `src/lib/icp/` (Zod schemas + config-as-data read/write + seed); a non-prototype app route (Server Component page + `'use server'` actions) graduating the prototype config screen; the screen's editor components adapted from the prototype into wired components.
- **Reused seams**: data via `src/lib/db` (`getDb()`), config via `src/lib/config/env`, sources + `enqueueScan` via `src/lib/signals`. No parallel mechanism.
- **Tests**: integration tests (gated on `TEST_DATABASE_URL`) for the config-as-data layer - active-rubric selection, additive versioning on save, seed idempotency, profile round-trip; unit tests for the rubric/profile Zod schemas.
- **Prototype**: the `src/app/prototype/icp-config` screen stays as the design reference; `src/app/prototype/README.md` registry updated to note the screen is now graduated/wired.
- **Governed by**: D6 (rubric as config-as-data), D1 (config-as-data the one kept discipline; auth deferred), the domain-model Rubric/USER_PROFILE entities, Drizzle-migrations-immutable. Architecture home: `docs/product-overview.md` (journey step 1; the qualifier section 5), the wired anchor view in `src/app/`.
