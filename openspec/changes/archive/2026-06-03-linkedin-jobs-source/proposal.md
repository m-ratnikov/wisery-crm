## Why

The connector contract, the scan pipeline, and the source-connection wizard are all in place, but no real source has landed - only the `fixture` connector. The first real one is a LinkedIn jobs source: it pulls job postings, which are a new entity the funnel does not yet carry. This change adds the `job` signal kind and the LinkedIn jobs connector so the pipeline can ingest jobs as first-class signals. Turning a job into person prospects (job -> hiring org -> decision-makers) needs the normalize-expand layer (M2), which is out of scope here; this change lands ingestion and the kind-routing that keeps a non-person signal from being mis-fed to the person qualifier.

## What Changes

- Add `job` to the `signal_kind` enum via an **isolated** `ALTER TYPE ... ADD VALUE 'job'` migration (no column uses the new value in the same migration - per the domain-model "never ADD-then-USE in one migration" rule; the connector emits it only at runtime after the migration commits).
- **Route the scan pipeline's enqueue-on-persist by signal kind**: a newly persisted `person` signal still enqueues qualify (today's behavior); a non-person signal (`company`, `content`, `job`) is persisted but **not** enqueued to qualify, because qualify scores a person and a non-person signal must first go through normalize-expand (M2, deferred). This makes "the queue handles different entity types" concrete: the persisted-signal handoff branches on kind at the composition root, not in any core.
- Add the **`linkedin-jobs` connector** implementing the `SignalSource` port: it reads its configured search settings, fetches job postings, and normalizes each into a `job`-kind `RawItem` (a stable `dedupKey`, a payload carrying the posting's fields). Register it in the connector registry.
- Add the **`linkedin-jobs` source-kind catalog entry** (reusing source-connection): a label and the per-kind settings (keywords, location, posted-within window) with a Zod config schema, so the connection wizard can configure a LinkedIn jobs source like any other.
- The network fetch is isolated behind a small client (coverage-excluded, exercised by a live smoke, like the Apify/Anthropic adapters); the normalization (API record -> `RawItem`) and the kind-routing are pure and unit-tested.

## Capabilities

### New Capabilities
- `linkedin-jobs-source`: the LinkedIn jobs connector (fetch + normalize job postings into `job`-kind signals) and its source-kind catalog entry so the wizard can configure it.

### Modified Capabilities
- `signal-ingestion`: the accepted connector-contract kinds gain `job`; and the persisted-signal-to-qualify handoff routes by kind - only `person` signals enqueue qualify, non-person kinds (`company`, `content`, `job`) persist without a qualify handoff and await normalize-expand.

## Impact

- **New code**: `src/lib/signals/connectors/linkedin-jobs.ts` (the connector + its pure normalization), a small fetch client for it (coverage-excluded), and a `linkedin-jobs` entry in `src/lib/signals/source-kinds.ts` (catalog) plus its registration in `src/lib/signals/registry.ts`.
- **Modified code**: a Drizzle migration adding `job` to `signal_kind`; `src/lib/signals/connector.ts` (`rawItemSchema` accepts `job` automatically once the enum grows - it validates against `signalKind.enumValues`); `src/lib/signals/pipeline.ts` + `scan-queue.ts` to pass the persisted signal's `kind` to `enqueueNext`; `src/lib/runtime/bootstrap.ts` to enqueue qualify only for `person` kind.
- **Canon touch**: `docs/architecture/domain-model.md` Signal `kind` annotation gains `job`; the scan-slice note records that the persisted-signal handoff routes by kind (person -> qualify; non-person -> awaits normalize-expand).
- **Unaffected**: qualify/draft/enrich cores, the review queue, the prospect model, the `/prototype` tree. No new external dependency in code (the live fetch uses the platform `fetch`; any credential is config-as-data).
- **Sequencing**: depends on source-connection-wizard (the catalog/wizard it plugs into, done). Independent of prospect-manual-origin / manual-lead-entry. Its migration must not be generated concurrently with manual-lead-entry's (the immutable migration journal is serial).
