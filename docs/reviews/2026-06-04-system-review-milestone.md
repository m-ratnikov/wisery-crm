# System review - milestone drift pass - 2026-06-04

Mode: **milestone** (whole wired tree). Reviewed state: working tree at HEAD
`5628e52be6a6996158bb732897c1ff224ae8d359` (this session's five changes were uncommitted on top,
so there was no clean git range for a convergence pass). Tier: code (`docs/process/system-review.md`), the
counterpart to `/verify-gate`. Three read-only lenses (static-composition, lifecycle-reachability,
invariant-canon) + chair synthesis.

Convergence under review: `app-shell-nav`, `source-connection-wizard`, `prospect-manual-origin`
(ADR-0010), `manual-lead-entry`, `linkedin-jobs-source` - the last two independently reshaped the
**same** seam (the scan->qualify handoff wiring at the composition root), which is exactly the
class a per-change review cannot see.

## Verdict: ship-with-fixes

No rework: every finding is a missing build-guard on a wiring that is correct today, a stale
description of correct code, or a deliberate deferral - none has an exhibited defective path. No
contradiction between lenses (the only overlap was constructive and is merged into PL-2).

**Success signal - the M1 strand class is CLOSED** (confirmed by lifecycle-reachability against the
real always-rejecting Apify adapter): `resolveQualifyHandoff` enqueues an unconditional draft job
for every qualified prospect on the qualify transaction, so a qualified prospect reaches `queued`
regardless of enrichment; both qualify workers share it, so a manual prospect reaches the queue
identically. Every Prospect state has a reachable outbound edge; crash/retry idempotency holds.

## Punch list

| ID | Sev | Location | Claim | Fix | Lens | Disposition |
|----|-----|----------|-------|-----|------|-------------|
| PL-1 | major | `.dependency-cruiser.cjs` / `src/lib/signals/source-kinds.ts` | No build rule stopped a connector from importing the port-side catalog (`source-kinds.ts`), which would invert the seam and risk an adapter->catalog->registry->adapter cycle that `verify` stays green on. The leaf `source-kind-schemas.ts` was added to avoid it, but only a comment enforced the intent. | dependency-cruiser rule `connectors-not-to-catalog`. | A | **promoted-to-fitness-function** (`connectors-not-to-catalog`, added; verify green) |
| PL-2a | minor | `src/lib/runtime/bootstrap.ts:61-66`; read-models start `from(prospects)` | A persisted non-person signal (company/content/job) gets no qualify handoff and normalize-expand (M2) does not exist, so it is a deferred terminal state that is invisible to the operator (a log line only) - a LinkedIn-jobs source persisting many job signals with zero prospects is, from the UI, indistinguishable from a broken scan. Not a strand (a Signal has no status). | Surface the deferral (a `deferredCount` on the scan run, or a "awaiting normalize-expand" read-model count). | B | **accepted-with-reason**: deliberate M2 deferral; the connector cannot live-fetch yet (not wired to an endpoint), so no operator can hit it. Surface when a live jobs fetch or normalize-expand lands. |
| PL-2b | minor | `openspec/specs/signal-ingestion/spec.md:63` | Live capability spec said signal kind is "(person, company, or content)" - omits `job`, an accepted enum value after `linkedin-jobs-source`. | Add `job`. | C | **fixed** |
| PL-2c | nit | `docs/architecture/system-context.md:40` | C4 L1 narrative omitted job postings from the inbound records. | Add "job posting". | C | **fixed** |
| PL-3 | minor | `src/lib/qualify/qualify-queue.ts` | `enqueueQualify` targeted `QUALIFY_PROSPECT_QUEUE` but its bare name implied the generic qualify queue (the signal-keyed variant is `enqueueQualifyInTx`). Wiring correct today; a naming hazard for future callers. | Rename to `enqueueQualifyProspect`. | A | **fixed** (rename + both call sites) |
| PL-4 | nit | `src/app/prototype/(app)/_data/settings.ts:26` | Prototype mock type union omits `"job"`. Prototype-only, no runtime effect. | Add `\| "job"` at graduation. | C | **accepted-with-reason**: prototype mock data; defer to screen graduation. |

## Fitness functions (mechanizable retirements)

| FF | Retires the class | Disposition |
|----|-------------------|-------------|
| FF-1 | App code reaching the in-transaction signal-keyed enqueue by name | **done** - eslint `no-restricted-imports` blocks `enqueueQualifyInTx` from `src/app/**` |
| FF-2 | A connector importing the port-side catalog (PL-1) | **done** - dependency-cruiser `connectors-not-to-catalog` |
| FF-4 | A domain pipeline core importing the jobs facade (honored by convention only) | **done** - dependency-cruiser `pipeline-not-to-jobs` |
| FF-3 | A pg-boss queue created without a worker, or vice versa (a partially-wired queue) | **promoted, to-write**: all 5 queues currently satisfy createQueue+work+enqueue (lens A confirmed); a `tests/queue-symmetry` unit is the tracked follow-up. accepted-with-reason until written. |
| FF-cluster | An enum value landing in `schema.ts` while canon enumerations (specs, domain-model, system-context) go stale (PL-2b/c) | **promoted, to-write**: a signal-kind enum/canon coherence check; tracked follow-up. |

## Loop

Fixes applied this pass (PL-1/FF-2, FF-4, FF-1, PL-2b, PL-2c, PL-3), then `npm run verify` re-run
green (typecheck, lint, format, dependency-cruiser with the two new rules passing, jscpd 0 clones,
150 tests, build). The new rules are now build-enforced, so re-finding their class is prevented
rather than relying on a future reviewer. Remaining open items (PL-2a observability, PL-4
prototype, FF-3 + FF-cluster to-write) are accepted-with-reason and tracked here; none blocks the
current tree.
