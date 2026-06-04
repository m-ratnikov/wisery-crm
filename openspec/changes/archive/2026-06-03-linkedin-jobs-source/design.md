## Context

`runScan` (`src/lib/signals/pipeline.ts`) persists each connector item as a `Signal` and, in the same transaction, calls an injected `enqueueNext(tx, signalId)` for every newly persisted signal. The composition root (`src/lib/runtime/bootstrap.ts`) wires that hook to `enqueueQualifyInTx`. Today only the `fixture` connector exists and it emits `person` signals, so enqueuing qualify for every signal is correct by accident. `qualifySignal` (`src/lib/qualify/pipeline.ts`) loads the signal and scores it as a person. `signal_kind` is a pg enum `{person, company, content}`; `rawItemSchema` validates `kind` against `signalKind.enumValues`. The source-connection wizard (just shipped) renders a kind's catalog entry and validates its config.

This change adds the `job` kind and the LinkedIn jobs connector, and makes the persisted-signal handoff route by kind so a non-person signal is not mis-fed to the person qualifier.

## Goals / Non-Goals

**Goals:**
- `job` is a first-class signal kind; the LinkedIn jobs connector ingests job postings as `job` signals.
- The persisted-signal -> qualify handoff routes by kind: `person` enqueues qualify; `company`/`content`/`job` persist without a qualify handoff.
- A LinkedIn jobs source is configurable through the existing wizard (a catalog entry with a Zod schema).

**Non-Goals:**
- No normalize-expand: turning a `job` (or company/content) signal into person prospects is M2, explicitly deferred. Job signals are ingested and sit at the top of the funnel.
- No new pipeline stage, no change to qualify/draft/enrich cores.
- No real LinkedIn credential management beyond config-as-data; the live fetch is structured but verified by a smoke, not unit tests (same posture as the Apify/Anthropic adapters).

## Decisions

### D1. `job` added via an isolated `ALTER TYPE ... ADD VALUE` migration

The migration only adds the enum value; nothing in that migration uses it. This honors the domain-model rule ("a pg enum grows by an additive `ALTER TYPE ADD VALUE`, applied in isolation, never ADD-then-USE in one migration") and the Postgres constraint that a newly added enum value is not usable until its transaction commits. The connector emits `job` only at runtime, long after the migration commits. `rawItemSchema` then accepts `job` automatically because it validates against `signalKind.enumValues`.

- **Why keep the enum, not move signal_kind to text+Zod**: per the decision on this change set, the kind set stays a pg enum and grows by additive `ALTER TYPE` (genuinely closed, low-churn). No model rewrite.

### D2. Route the handoff by kind at the composition root, not in a core

`enqueueNext` gains the persisted signal's kind: `(tx, signalId, kind)`. `runScan` already has `parsed.data.kind` at the persist point, so it passes it through. The bootstrap hook becomes: `if (kind === 'person') await enqueueQualifyInTx(tx, signalId)` - non-person kinds persist with no handoff. The routing decision lives at the composition root (where the cross-stage wiring already lives), so no core or connector learns about qualify, preserving the port/adapter and db-only-core seams. The scan pipeline stays kind-agnostic about persistence (it persists any valid kind); only the handoff is routed.

- **Why not branch inside qualify (early-return for non-person)**: that couples qualify to the kind taxonomy and still burns a job per non-person signal. Routing at the enqueue point keeps non-person signals off the queue entirely until normalize-expand exists to handle them.
- **Why not a new "expand" enqueue now**: normalize-expand is M2; this change deliberately lands ingestion + routing and leaves the non-person branch as "persist, no handoff" (the honest current capability).

### D3. The connector: network isolated, normalization pure

`linkedin-jobs.ts` implements `SignalSource` (`kind = "linkedin-jobs"`). `scan(source)` reads the source config (keywords, location, posted-within), calls a small fetch client for the LinkedIn jobs endpoint, and yields one `job`-kind `RawItem` per posting via a pure `normalizeJob(record) -> RawItem` (stable `dedupKey` from the posting's stable id; payload carrying title, company, location, url, posted-at). The fetch client is coverage-excluded (network adapter needing access, exercised by a live smoke - the precedent set by `apify.ts`/`anthropic.ts` in `vitest.config.ts`); `normalizeJob` and the config schema are pure and unit-tested.

- The source `kind` string is `"linkedin-jobs"`; the signals it emits are `kind = "job"`. (Source kind != signal kind - a source kind names the adapter; the signal kind names the entity.)

### D4. Catalog entry so the wizard configures it

Add a `linkedin-jobs` `SourceKindDef` to `source-kinds.ts`: label "LinkedIn jobs", fields `keywords` (required), `location`, `postedWithin`; a Zod `configSchema`. It appears in the wizard only once the connector is registered (the catalog/registry intersection already enforced by `listConnectableKinds`).

## Risks / Trade-offs

- **A job signal is a dead end until M2** -> accepted and explicit: job signals are ingested and visible as signals but produce no prospects yet; the proposal and the modified signal-ingestion spec state this so it is not mistaken for a bug. `log` a count of non-person signals persisted-without-handoff so the deferral is observable.
- **The enum value cannot be used in the same migration** -> D1 isolates it; the connector uses it only at runtime.
- **Routing regression risk** (a person signal stops being qualified) -> a unit test asserts the bootstrap hook enqueues qualify for `person` and does not for `job`/`company`/`content`.
- **No real LinkedIn jobs access in CI** -> normalization + routing + catalog are unit-tested; the live fetch is a smoke, consistent with the existing network-adapter coverage exclusions.

## Migration Plan

One isolated migration: `ALTER TYPE "signal_kind" ADD VALUE 'job';` (generated via `db:generate`; verify it contains only the ADD VALUE and is its own migration file - never combined with a use of the value). Apply via `db:migrate`. Additive and reversible only by a new migration (immutable). Rollback of the feature is a code revert; the enum value can remain unused harmlessly.
