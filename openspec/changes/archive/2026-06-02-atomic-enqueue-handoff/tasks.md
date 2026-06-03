## 0. Cross-view consistency check

- [x] 0.1 Confirm the system-design runtime flows match the unchanged lifecycle/events in docs/architecture/domain-model.md (no new state or event; only the handoff durability changes)
- [x] 0.2 Confirm the atomic guarantee's stated precondition (pg-boss shares the app database) matches the config reality (`PGBOSS_DATABASE_URL` defaults to `APP_DATABASE_URL`, src/lib/config/env.ts) and the deployment note
- [x] 0.3 Confirm ADR-0009 refines, not supersedes, ADR-0001 (handler error propagation / retry unchanged) and relates to ADR-0004 (the facade is where the transactional-enqueue entry point lands)

## 1. Reconcile the spine (docs/product-overview.md)

- [x] 1.1 Reviewed docs/product-overview.md section 4: it is a high-level pipeline diagram that does not describe handoff/enqueue mechanics, and there is no related reliability open question - so NO change needed (the handoff-durability concern lives in domain-model + cross-cutting). No edit.
- [x] 1.2 Locked-decisions table is D1-D10 product decisions; ADR-0009 is an implementation reliability ADR refining ADR-0001, not a new D-level decision - so NO row added. No edit.

## 2. Distribute the views by scope (docs/architecture/)

- [x] 2.1 domain-model.md: replace the events-table "Current implementation note" (the at-least-once fire-and-forget strand caveat) with the atomic enqueue-in-transaction resolution; the events/lifecycle tables themselves are unchanged. Strip any `<!-- v:... -->` anchors
- [x] 2.2 system-design.md: add/relocate the runtime handoff flow (the enqueue-in-transaction sequence) into the pipeline runtime-flows section; keep one copy. Strip anchors
- [x] 2.3 cross-cutting.md: record the background-jobs reliability/durability concern - atomic enqueue-in-transaction via fromDrizzle, and the same-database co-location constraint - pointing to ADR-0009. Strip anchors

## 3. Promote ADRs

- [x] 3.1 Promote adr/0009-atomic-enqueue-handoff.md to docs/adr/0009-atomic-enqueue-handoff.md (reconfirm 0009 is still the next free sequence), set Status to accepted with today's date, strip the `<!-- v:... -->` anchors and convert cross-ADR links to plain-text citations (matching the existing 0005-0008 convention - no anchors, plain "ADR-NNNN" text), point Source at the archived change folder, and cross-link from the canon

## 4. Cross-link

- [x] 4.1 Wire links: product-overview pipeline note -> ADR-0009; domain-model note -> ADR-0009; cross-cutting concern -> ADR-0009; ADR-0009 Source -> system-design (archived) and the canon homes

## 5. Implement the atomic handoff (code)

- [x] 5.1 Jobs facade (src/lib/jobs/index.ts): add `enqueueInTx(tx, queue, data, options)` that calls `getBoss().send(queue, data, { ...options, db: fromDrizzle(tx, sql) })` (import `fromDrizzle` from pg-boss, `sql` from drizzle-orm). Keep the existing fire-and-forget `enqueue` for user-triggered (manual/batch) enqueues, which are not pipeline handoffs
- [x] 5.2 Qualify pipeline (src/lib/qualify/pipeline.ts): accept an injected `enqueueNext?: (tx, qualifiedProspectIds) => Promise<void>` and call it INSIDE the existing prospect+scoring transaction (the LLM score already runs before the tx). The worker (qualify-queue) threads it through from bootstrap
- [x] 5.3 Scan pipeline (src/lib/signals/pipeline.ts + scan-queue): enqueue the qualify job for each persisted signal inside the same transaction that persists the signal, via an injected `enqueueNext(tx, signalId)`; preserve dedup-miss semantics (only newly persisted signals hand off)
- [x] 5.4 Enrich pipeline (src/lib/enrich/pipeline.ts): enqueue the forced re-draft inside the dossier-upsert transaction via an injected `enqueueNext(tx, prospectId)`
- [x] 5.5 Bootstrap (src/lib/runtime/bootstrap.ts): replace the post-commit `onSignalsPersisted`/`onProspectsQualified`/`onEnriched` hooks with injected transaction-aware `enqueueNext` callbacks that use `enqueueInTx`. Preserve: drafting is terminal (no handoff); the auto-enrich routing (always draft + additionally enrich when the setting is on); no stage imports a sibling
- [x] 5.6 Tests (gated integration): a stage's state write and its handoff job commit together - assert the next-stage job row exists in pgboss after a successful stage; and a stage whose transaction rolls back leaves NEITHER the state row NOR the job (no strand, no orphan job). Cover the qualify -> draft handoff at minimum

## 6. Verify

- [x] 6.1 `npm run verify` green (typecheck, lint, depcruise, jscpd, per-file coverage, build) against a reachable test Postgres
- [x] 6.2 Canon integrity: tests/canon-integrity.test.ts passes (required sections present, links resolve, no dangling archive-only references, no leaked `<!-- v:... -->` anchors in promoted views); `openspec validate --all --strict` green
- [x] 6.3 Read-only context-complete re-review of the code delta per the looping rule, then archive (--skip-specs; this is an architecture change with no spec deltas)
