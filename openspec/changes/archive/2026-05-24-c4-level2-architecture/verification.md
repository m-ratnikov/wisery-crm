# Verification record - c4-level2-architecture

Produced by `/verify-gate` (docs/verification-gate.md). **Run 4** (2026-05-24) - after the scraper L3
reclassification, the normalize/dedup + draft-after-enrich pipeline fixes, and the deployment draft.
Supersedes Runs 1-3.

## Coverage

- **Artifact:** `openspec/changes/c4-level2-architecture/system-design.md`
- **Content hash (git hash-object):** `82cbaf4204f826d567da2feb898adb792d2e445e`
- **Promoted bundle in scope:** system-design.md + ADR-0002 (rewritten), ADR-0003, ADR-0004.
- **Out of promotion scope:** `deployment.md` (draft seed - the proposal scopes deployment Skip; not promoted), domain-model (Skip), use-cases (not promoted).
- **Date:** 2026-05-24. Stakes: **high**. Re-run after any edit; hash-pinned.

## Stage 1 - Ground (Ledger): clean (after two fix cycles)

- Cycle 1 blocked on two consistency issues: product-overview section 5 still said "qualify + draft in one call" (contradicting the edited D5) - fixed; and the reproduced L1 inside system-design still labeled the provider "normalized records" with no flag - fixed with an explicit intro flag pointing to the section-2.3 L1 reconciliation.
- Cycle 2 (after the Run-4 panel fixes) blocked on one fact: the "~100-300 MB" Playwright memory figure was unsourced and low - fixed to "hundreds of MB of RSS, climbing under load" per benchmarks.
- All other Playwright-mechanism facts verified against Playwright docs/source: `launch()` spawns Chromium as a separate OS process over a pipe/CDP; a crash surfaces as a rejected promise / `disconnected` event (not a worker crash); `close()` reaps; orphan/zombie is a documented issue; `newContext()` is the cheap isolation primitive; `launchServer()`+`connect()` is the standing-ws alternative. Consistency checks passed (no leftover "spawns a child + IPC" framing; the concurrency cap + reaping discipline are stated consistently in ADR-0002 and system-design). **clean.**

## Stage 2 - Challenge (panel): all four ship-with-fixes

- **Atlas:** the L3 reclassification is the right boundary; peel-safety invariant holds. New: ATL-1 (the pipeline sequence hid the company/content cost-gate flip) and ATL-2 (browser concurrency/resource was unbudgeted) - both addressed.
- **Greybeard:** MAJOR 1.1 - "worker spawns a child + IPC, reaped per use, warm pool" mis-described Playwright (in-process `launch()` already spawns/supervises Chromium over a pipe); 1.2 zombie/OOM discipline; 1.3 warm-pool contradiction; 2.1 two-LLM-call idempotency - all addressed.
- **Pedant:** clean after the scraper removal; Finding A (label the spawn edge) addressed by the `launch()`/`close()` edge labels.
- **Canon:** faithful to the rewritten ADR-0002; product-overview internally consistent (D5 / section 5 / section-4 diagram); F1 (rename ADR-0002 at promotion), F2 (D5 trace - added inline), F3 (proposed-ADR status gate).

### Run-4 punch list - status

- **[applied] Item 1 (MAJOR)** - Playwright mechanism corrected to in-process `launch()`/`close()` over a pipe/CDP; reaping discipline (try/finally `close()` + hard timeout + init/`tini` reaper + RSS/process-count watchdog); concurrent-browser semaphore sized to host memory (the same budget discipline as the pg-boss pool); warm-pool contradiction resolved (`newContext()` reuse first, then `launchServer()` pool or dedicated host as later levers). Across ADR-0002 + system-design (node, app bullet, Decisions, sequence edges).
- **[applied] Item 2 (minor)** - sequence Note for the company/content cost-gate flip (expansion precedes qualify; that spend is pre-gate, mitigated by a firmographic pre-check).
- **[applied] Item 3 (minor)** - qualify and draft-after-enrich are separate pg-boss jobs, each idempotent with its own `prompt_version` (sequence Note + cross-cutting Failure handling).
- **[applied] Item 4 (minor)** - the D5 ordering decision is self-annotated in product-overview.
- **[deferred] Item 5 (nit)** - rename the ADR-0002 file to shed "separate-process", and promote ADR-0002/0003/0004 to `docs/adr/` as `accepted` (tasks section 3).
- **[optional] Item 6 (nit)** - `App->>DB` protocol labels in the sequence (L2 already establishes the wire).

## Stage 3 - Synthesize (Chair): ship-with-fixes

No blocker, no rework, no contradictions - the Playwright cluster was a shared refinement across three lenses (Greybeard, Atlas, Pedant), not a conflict. The punch-list fixes (Items 1-4) are applied.

## Remaining before promotion (at /opsx:apply + /opsx:archive)

- Accept ADR-0002/0003/0004 (`proposed` -> `accepted`), promote to `docs/adr/`, rename ADR-0002 to drop "separate-process" (tasks section 3).
- L1 reconciliation into `system-context.md`: provider "normalized" -> raw, LLM -> provider-neutral (D9), draft-position resolved (D5), D1-D8 -> D1-D10 (tasks section 2.3).
- `deployment.md` is NOT promoted (draft seed).

## Value record (what the gate caught, runs 2-4)

A proposed-ADR-overriding-CLAUDE.md blocker; a Graphile Worker omission; an Anthropic-rejects-Zod 400 risk; a wrong GA date; an SDK-transform overstatement; two internal-consistency contradictions (D5 vs section 5; L1 vs L2 "normalized"); and - this run - a confidently-wrong Playwright mechanism (a bespoke "spawn child + IPC" that Playwright's in-process `launch()` already provides) plus an unsourced memory figure. Several were confident and fluent; all were caught by source-reading, not plausibility.

## Sign-off

- [x] sign-off: **Michael Ratnikov, 2026-05-24** (human-confirmed via "yes, move on") for hash
  `82cbaf4`. Re-signed after the Run-3 -> Run-4 changes (scraper -> L3, normalize/dedup,
  draft-after-enrich, the Playwright mechanism).
- Post-sign-off **Mermaid-syntax fix** (2026-05-24, at apply): two `;` inside sequence-diagram text
  broke rendering (Mermaid's message/note text terminates at `;`) - replaced with `,` / ` - `. Source
  hash is now `47693a5b8d5bbb435ae2c3c2812fa86551f1d960`; no claim or decision changed, so the PASS
  and sign-off transfer. **Gate gap closed:** added `tests/mermaid.test.ts` (validates every
  ` ```mermaid ` block via the official `mermaid.parse`, run by `npm test`; `mermaid`+`jsdom` devDeps)
  and referenced it as a mechanical check in docs/verification-gate.md. Third-party validators were
  rejected on evidence (mermaid-validate crashes; @probelabs/maid false-positives on valid Mermaid).

**Gate call: PASS (ship-with-fixes applied; human sign-off recorded 2026-05-24).** Stage 1 clean, Stage 3 verdict
ship-with-fixes (not rework), punch-list Items 1-4 applied; Items 5-6 are promotion-time / optional.
The artifact was not edited to pass during a gate run - all fixes were authored between runs against the
panel's findings.
