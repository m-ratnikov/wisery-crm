## 1. Correct the code comments and UI copy (no logic change)

- [x] 1.1 `src/lib/enrich/enrich-queue.ts`: reword the `enqueueEnrichInTx` doc comment - it is the transaction-aware enqueue seam reserved for a future auto-enrich-on-approval (the qualify auto-enrich path it cited is gone, ADR-0019/0022); the function is intentionally retained, not dead. Also fix the `ENRICH_QUEUE` comment that lists "the auto-enrich routing" as a current trigger. Verify: typecheck green; no behavior change.
- [x] 1.2 `src/lib/enrich/settings.ts`: reword the header comment - the setting is persisted and reserved for auto-enrich-on-approval, not wired to qualification. Verify: typecheck green.
- [x] 1.3 `src/app/(app)/settings/page.tsx`: fix the section copy ("Turn this on to enrich every qualified prospect automatically" and the "Auto-enrich qualified person" label) to state the setting is persisted but routes nothing today, reserved for auto-enrich-on-approval. Verify: build green; the toggle still persists.
- [x] 1.4 `src/app/(app)/prospect-list/page.tsx` and `_components/ProspectGrid.tsx`: fix the comments that describe the auto-enrich toggle as governing qualify-time enrichment. Verify: build green; the toggle still persists on/off.

## 2. Reconcile the canonical spec

- [x] 2.1 The `prospect-list` auto-enrich requirement delta (this change's `specs/prospect-list/spec.md`) merges into `openspec/specs/prospect-list/spec.md` at archive: the requirement persists the setting, states it routes nothing today, and reserves it for auto-enrich-on-approval. Verify: `openspec archive` validates the merged spec.

## 3. Verify

- [x] 3.1 Run `npm run verify` (typecheck, lint, format, dependency-cruiser, jscpd, per-file coverage, build) green, and a `code-review` pass on the diff; loop fixes through re-verify until clean.
