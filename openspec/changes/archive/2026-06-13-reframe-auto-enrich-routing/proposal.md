# Reframe the auto-enrich setting - persisted, currently unwired, reserved for auto-enrich-on-approval

## Why

The auto-enrich setting promises behavior it no longer delivers. It was wired to the `ProspectQualified` event (auto-enqueue enrichment when a prospect qualified); that event was retired by ADR-0019, and per-person qualification was removed entirely by ADR-0022. So the toggle persists a flag that routes nothing, and the canonical prospect-list spec still says it "governs whether newly qualified prospects are enriched automatically" - a claim that is now false. We keep the setting (it is the natural control for a future auto-enrich-on-approval: auto-enqueue enrichment when the user approves a signal), but make canon and the code tell the truth about its current state.

## What Changes

- The auto-enrich setting, its `settings.auto_enrich` column, the prospect-list and Settings toggles, `src/lib/enrich/settings.ts`, and `enqueueEnrichInTx` (the transaction-aware enqueue seam an on-approval wiring would call) are all **kept** - no deletion, no migration, no behavior change.
- The canonical `prospect-list` auto-enrich requirement is reworded: it no longer references qualification routing. The setting SHALL be persisted; its routing is currently **unwired** (the qualify trigger it hung on is gone) and reserved for a future auto-enrich-on-approval.
- Stale code comments and UI copy that describe qualify-time auto-enrich ("auto-enrich every qualified prospect", "the qualify prospect-write tx when auto-enrich is on", "newly qualified prospects") are corrected to say the setting is persisted-but-unwired, reserved for auto-enrich-on-approval.
- Wiring auto-enrich-on-approval itself is **out of scope** - it is a future feature decision; this change only stops the setting lying about what it does today.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `prospect-list`: the "user controls auto-enrich" requirement is reworded - the setting persists, but its value does not currently route any enrichment (no qualification exists to route on); it is reserved for a future auto-enrich-on-approval. The toggle behavior (persist on/off) is unchanged.

## Impact

- **Spec**: `openspec/specs/prospect-list/spec.md` - the auto-enrich requirement and its scenario (delta).
- **Code comments only** (no logic change): `src/lib/enrich/enrich-queue.ts` (`enqueueEnrichInTx` doc), `src/lib/enrich/settings.ts`, `src/app/(app)/settings/page.tsx` (the "Auto-enrich qualified person" copy + helper text), `src/app/(app)/prospect-list/page.tsx` and `_components/ProspectGrid.tsx` (the toggle comment).
- **Not changed**: the `settings` table and `auto_enrich` column (kept as the per-tenant productization hook and the on-approval control), `setAutoEnrich`/`getSettings`, `enqueueEnrichInTx`, the toggle's persist behavior. No migration.
- **Not affected**: enrichment itself (still user-triggered single/batch from the list), triage approval, scoring (already signal-only per ADR-0022).
