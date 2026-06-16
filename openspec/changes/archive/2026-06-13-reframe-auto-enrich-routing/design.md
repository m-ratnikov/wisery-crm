## Context

The auto-enrich setting predates two decisions that hollowed out its meaning. ADR-0019 retired the `ProspectQualified` event (and "withdrew the auto-enrich-on-`ProspectQualified` setting"), but the code surface - the column, the two toggles, `setAutoEnrich`, and `enqueueEnrichInTx` - was left in place. ADR-0022 then removed per-person qualification entirely. The result is a persisted flag with no consumer, and a canonical prospect-list requirement asserting routing that no longer exists. The owner wants to keep the setting because it is the natural control for a future auto-enrich-on-approval (auto-enqueue enrichment when a signal is approved), so the fix is truth-in-canon, not removal.

## Goals / Non-Goals

**Goals:**

- The canonical prospect-list spec describes the setting accurately: persisted, routes nothing today, reserved for auto-enrich-on-approval.
- Code comments and UI copy stop referencing qualify-time auto-enrich.
- The `enqueueEnrichInTx` seam is preserved and re-documented as the enqueue an on-approval wiring would call.

**Non-Goals:**

- Wiring auto-enrich-on-approval (a future feature; needs its own design - which lifecycle point, idempotency with the approval transaction, whether manual-origin people participate).
- Any schema change: the `settings` table and `auto_enrich` column stay (the per-tenant productization hook and the on-approval control).
- Any behavior change: the toggle still persists on/off; enrichment is still triggered only by the explicit single/batch actions.

## Decisions

1. **Keep the setting and the seam, reframe the contract.** Alternative considered: delete the whole auto-enrich surface (toggle, column, `enqueueEnrichInTx`) as dead code. Rejected by the owner - the setting is wanted for auto-enrich-on-approval. So the change is a reword of the spec requirement plus comment/copy corrections; `enqueueEnrichInTx` stays as the transaction-aware seam that an on-approval wiring at the composition root would inject (the same atomic-enqueue pattern, ADR-0009).
2. **State the unwired status explicitly rather than silently.** The reworded requirement and the UI copy say the setting routes nothing today and is reserved for on-approval, so a reader (or the operator toggling it) is not misled into thinking it does something. This is the "no silent caps" discipline applied to a dormant feature.
3. **No migration.** Dropping `auto_enrich` was considered and rejected (data-model answer): the column is retained as the on-approval control and the per-tenant hook the schema comment already describes.

**Reuse:** pure documentation/spec correction over existing seams - `src/lib/enrich/settings.ts` (`getSettings`/`setAutoEnrich`), `enqueueEnrichInTx` (`src/lib/jobs` facade), the two existing Server Actions. No new module, no new mechanism.

## Risks / Trade-offs

- [A dormant toggle the operator can switch but that does nothing may confuse] -> the UI copy now states it is reserved for a future auto-enrich-on-approval and routes nothing today; the operator sees the honest status rather than a silent no-op.
- [Keeping `enqueueEnrichInTx` with no caller reads as dead code to a future reviewer] -> its comment now names it the on-approval enqueue seam (intentionally retained), and the design records the deferral, so the retention is explained rather than mysterious.
- [The broader prospect-list spec still carries other ADR-0019 drafting staleness (re-draft, selected-draft facets) and ADR-0022 score references in its Purpose/Architecture] -> out of scope here; flagged as separate pre-existing debt, not silently absorbed into this change.

## Open Questions

- The shape of auto-enrich-on-approval (trigger point, atomicity with the approval transaction, manual-origin participation) is deferred to that feature's own change.
