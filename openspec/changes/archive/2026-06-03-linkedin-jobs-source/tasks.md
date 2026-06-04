## 1. The `job` signal kind (isolated migration)

- [x] 1.1 Add `job` to the `signalKind` pg enum in `src/lib/db/schema.ts` (`["person", "company", "content", "job"]`).
- [x] 1.2 Generate the migration with `npm run db:generate` and verify it is an **isolated** `ALTER TYPE "signal_kind" ADD VALUE 'job'` in its own migration file, with no column/use of the value in the same migration (the "never ADD-then-USE in one migration" rule). Confirm `rawItemSchema` now accepts `kind: "job"` (it validates against `signalKind.enumValues`, no code change needed).

## 2. Route the persisted-signal handoff by kind

- [x] 2.1 Extend the `enqueueNext` hook signature in `src/lib/signals/pipeline.ts` and `src/lib/signals/scan-queue.ts` to carry the persisted signal's kind: `(tx, signalId, kind)`. `runScan` passes `parsed.data.kind` at the persist point.
- [x] 2.2 In `src/lib/runtime/bootstrap.ts`, route the scan worker's `enqueueNext`: enqueue qualify (`enqueueQualifyInTx`) only when `kind === "person"`; for non-person kinds persist with no handoff and `log` a count so the deferral (await normalize-expand) is observable.

## 3. The LinkedIn jobs connector

- [x] 3.1 Add `src/lib/signals/connectors/linkedin-jobs.ts` implementing `SignalSource` (`kind = "linkedin-jobs"`): read the source config, call the fetch client, and yield one `job`-kind `RawItem` per posting via a pure `normalizeJob(record) -> RawItem` (stable `dedupKey` from the posting's stable id; payload = title, company, location, url, posted-at).
- [x] 3.2 Put the network fetch in a small client (its own module) that is added to the coverage `exclude` list in `vitest.config.ts` (network adapter needing access, exercised by a live smoke - same precedent as `apify.ts`/`anthropic.ts`). Keep `normalizeJob` and the config schema OUT of that module so they stay coverage-included and unit-tested.
- [x] 3.3 Register the connector in `src/lib/signals/registry.ts` (one line: `kind -> connector`).

## 4. Wizard configuration (catalog entry)

- [x] 4.1 Add a `linkedin-jobs` `SourceKindDef` to `src/lib/signals/source-kinds.ts`: label "LinkedIn jobs", fields `keywords` (required), `location`, `postedWithin`; a Zod `configSchema`. It appears in the wizard automatically once the connector is registered (the catalog/registry intersection in `listConnectableKinds`).

## 5. Canon touch

- [x] 5.1 `docs/architecture/domain-model.md`: add `job` to the Signal `kind` annotation (`person, company, content, job`) and add a one-line note that the persisted-signal handoff routes by kind (person -> qualify; non-person -> awaits normalize-expand). Keep within the canon-integrity manifest (no dangling refs).

## 6. Tests and verification

- [x] 6.1 Unit test `normalizeJob`: a posting record maps to a `job`-kind `RawItem` with a stable dedup key and the expected payload fields; a missing stable id is handled (dropped or thrown per the contract).
- [x] 6.2 Unit test the kind-routing: the scan worker's `enqueueNext` enqueues qualify for a `person` signal and does NOT for `job`/`company`/`content` (assert via a fake enqueue capturing calls).
- [x] 6.3 Unit test the `linkedin-jobs` catalog entry: it is connectable once registered, its `configSchema` accepts a config built from its declared fields (the drift guard), and `keywords` is required.
- [x] 6.4 Integration (DB-gated, like source-config.test.ts): a scan via a fixture-injected jobs connector persists `job` signals and enqueues no qualify job for them; a `person` signal still enqueues qualify.
- [x] 6.5 `npm run verify` green (typecheck, lint, format, dependency-cruiser, jscpd, per-file coverage, build).
- [x] 6.6 `code-review` pass on the change surface (loop: re-verify and re-review the fix delta until a pass finds nothing material) before archive.
