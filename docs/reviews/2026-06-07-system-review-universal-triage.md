# System review - universal triage + engagement (ADR-0013..0018)

- Mode: convergence (the four just-landed code slices share a tree for the first time)
- Reviewed commit: `5d1738b` (the converged delta is the working tree at this commit)
- Lenses: static-composition (A), lifecycle-reachability (B), invariant-canon (C) + chair
- Verdict: **rework** (one runtime blocker + one unresolved contradiction needing a decision)

## Headline

One live blocker - peer Persons scored against the buyer (ICP) rubric, silently poisoning the
ADR-0005 learning loop the moment a peer is approved - plus an unresolved B-vs-C contradiction over
the dead-but-armed `qualifySignal` path. Lens B proved the converged seams strand-free; the load is
the invariant drift, not the state machines.

## The contradiction (B vs C) - settle, do not average

- **Lens B (ship):** `enqueueQualifyInTx` has **zero production callers** - the signal-keyed
  auto-create fan-out is dead at runtime; nothing bypasses the ADR-0013 triage gate today.
- **Lens C (rework):** yet `registerQualifyWorker` is still wired live (`bootstrap.ts:51`), so the
  `qualify` queue exists and `qualifySignal` (creates a Person directly from a signal) would run if
  anything enqueued to it. `qualifySignal` is the test harness in **7 files**, so deleting it forces
  a harness migration.
- **Resolution chosen (this pass):** deregister `registerQualifyWorker` (remove the runtime arming -
  with no worker, an enqueue cannot execute), keep `qualifySignal` as a test-only helper, and a
  follow-up fitness function locks out production use of `enqueueQualifyInTx`. This makes Lens B's
  "dead" literally true and removes Lens C's "armed" risk without the 7-file migration.

## Punch list

| # | Sev | Location | Claim | Lens | Disposition |
|---|-----|----------|-------|------|-------------|
| 1 | blocker -> latent | `qualify/pipeline.ts:129` -> `scorer.ts` | `qualifyProspect` omitted `rubricKind` -> defaulted to `icp` regardless of `person.type`. Chair framed this as a live loop-poisoning blocker, but on closer read it is **latent**: the content->peer branch (`decide.ts:61-80`) creates the peer + Post but does NOT enqueue qualify (only the person->prospect branch does, line 88), so no peer reaches `qualifyProspect` in production today. The fix is correctness-in-depth for when durable peer scoring is wired. | C | **fixed** (defensive: derive `rubricKind` from `person.type`) |
| 2 | blocker (process) | `qualify-queue.ts:19` vs `bootstrap.ts:51` vs `pipeline.ts:50` | Dead-by-ADR-0013 signal auto-create path is dead at runtime (B) but still registered as a live worker (C). | B vs C | **fixed** (deregistered worker) + promote-to-fitness-function (guard `enqueueQualifyInTx`) |
| 3 | major | `comments/generate.ts:47` | Reads `p?.name/headline/company` off the person row - NULL for a signal-origin peer (identity is in `signals.payload`); bypasses the PersonSubject seam (ADR-0010). The common peer gets a context-blind comment. | C | **fixed** |
| 4 | major | `triage/advisory.ts:6` -> `qualify/scorer.ts`; `triage/decide.ts:5` -> `posts/dedup.ts` | Triage reaches into two peer slices' internals with no dependency-cruiser rule. | A | promote-to-fitness-function (open) |
| 5 | major | `posts/read.ts:20` vs `prospect/read.ts:35` | Two representations of the person name-resolution rule with divergent fallbacks. | C | accepted-with-reason (documented; SQL path is the Feed read; reconcile next) |
| 6 | major | `schema.ts:138/185/243` | `Rubric.kind`, `Person.type`, `SignalDecision.disposition` are `text` with no Zod enum though the canon mandates text+Zod. | C | **fixed** (`rubricKindSchema` in icp/schema, `personTypeSchema` in qualify/status, `signalDispositionSchema` in triage/decide; the loose `rubricKind: string` flow is now typed end to end; `person.type` validated at the qualify read boundary) |
| 7 | minor | `posts/dedup.ts` | Pure L0 file not matched by `pure-kernel-no-runtime-io` (naming gap). | A | **fixed** (added `posts/dedup.ts` to the `pure-kernel-no-runtime-io` `from` pattern) |
| 8 | minor | `posts/pipeline.ts setMonitored` | A 2-line person write in the orchestration core drags the enrichment factory into the action graph. | A | accepted-with-reason (move next; no rule violated today) |
| 9 | minor | `scorer.ts:50` + `icp_score_v1.ts` | Prompt says "ICP"/"prospect" though the scorer now serves peer/company kinds. | C | accepted-with-reason (rubric criteria carry the semantics; revisit before peer rubric ships) |

## Load-bearing invariants to PRESERVE (Lens B)

- `triage/read.ts` triage inbox MUST stay a LEFT JOIN on `signal_advisory` - an INNER JOIN would
  vanish any signal whose advisory job dead-lettered. This is the anti-strand invariant.
- Triage approval writes `SignalDecision` + the routed entity + qualify-enqueue in ONE transaction
  (`decide.ts`), and the `signal_decisions.signal_id` UNIQUE constraint makes a concurrent
  double-approve roll back to one winner. Keep both.

## Fitness functions

Landed this pass:
- widened `pure-kernel-no-runtime-io` to cover `posts/dedup.ts` (#7) - done.

Still to add (open):
- `no-production-import-of-enqueueQualifyInTx` (#2): no `src/**` except `*.test.ts` imports it.
  The runtime arming is already removed (worker deregistered); this rule locks it.
- `triage-not-to-qualify-internals` / `triage-not-to-posts-internals` (#4) - each requires the
  coupling to be removed first (inject the scorer at the composition root; inline/share
  `dedupKeyFor`), so it is a small refactor + rule, not a pure rule add. Deferred as a structural
  improvement (no canon currently mandates inter-slice constraints; the build-enforced boundaries
  are the L0 kernel, the jobs facade, and the adapter seams).
- enum-coverage (#6): the three Zod schemas now exist; an automated check that every enumerated
  `text` column in `schema.ts` has a paired Zod schema would retire the class for good.
