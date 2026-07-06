---
name: "System Review"
description: Run the whole-system code review (3 orthogonal read-only lenses + chair synthesis) over what spans changes, and write a lightweight review record. Code tier - the counterpart to /verify-gate (which is for architecture artifacts).
category: Engineering
tags: [review, system, seams, code, fitness-functions]
---

Run the system review (`docs/process/system-review.md`) over the wired code tree and write a review
record. This is the code-tier counterpart to `/verify-gate` (which reviews architecture
artifacts). It catches seam bugs that live in no single diff - the class per-change `code-review`
cannot see by construction.

**Input**: an optional scope.
- A git range (e.g. `@{upstream}...HEAD`, `main...HEAD`) -> **convergence mode**: review the
  just-converged delta plus its immediate seams. This is the primary, cheapest trigger - run it
  when independently-built capabilities first share a tree.
- No argument -> **milestone mode**: a global drift pass over the whole tree (run alongside
  `npm run test:mutation`).

**Scope guard (first step)**: this reviews CODE. For an architecture artifact (C4 / ADR /
system-design / domain-model), STOP and use `/verify-gate` instead - different medium, different
gate.

**Steps**

1. **Scope the read.** Resolve the span: in convergence mode, `git diff <range> --stat` to find
   the converged capabilities and their seams; in milestone mode, the whole tree. Capture the
   reviewed commit now: `git rev-parse HEAD`.

2. **Dispatch the three lenses in parallel** (read-only - they use Read/Grep/Glob only and must
   never run a generator, migration, or any mutation):
   - `static-composition` (lens A) - wiring, port direction, server-only/secrets, fitness-function gaps
   - `lifecycle-reachability` (lens B) - state-machine reachability under the REAL adapter dispositions
   - `invariant-canon` (lens C) - knowledge-DRY, derived-vs-stored, code-vs-canon drift

   Tell each lens the scope, and two rules: (a) a finding is admissible only with an **exhibited
   path** (`file:line -> file:line` reaching the bad state); (b) it may NOT file anything a
   single-diff review could have caught - only what spans changes.

3. **Synthesize.** Dispatch `chair` with the three lenses' findings. Chair dedupes, ranks by
   severity, **surfaces contradictions between lenses rather than resolving them silently**,
   rejects any finding lacking an exhibited path, and emits one triaged punch list with a single
   verdict (`ship` / `ship-with-fixes` / `rework`).

4. **Write the record** to `docs/reviews/<YYYY-MM-DD>-system-review-<scope>.md`:
   - mode (convergence/milestone) and the reviewed commit (`git rev-parse HEAD`);
   - the Chair punch list (severity, location, claim, fix, which lenses raised it);
   - the verdict + headline;
   - a **disposition** column to fill as fixes land: `fixed` / `promoted-to-fitness-function`
     (name the dependency-cruiser rule or test) / `accepted-with-reason`.
   No `git hash-object` gating - this tier promotes nothing to immutable canon (CI re-verifies
   whole-tree on every push), so a stale-hash check would have no consumer. The record is
   provenance, not a gate.

5. **Loop, not one-shot.** If fixes are applied, re-run `npm run verify` AND re-dispatch the
   relevant lens(es) over the fix delta **in full context** (surrounding code, callers, the
   invariants it touches - not the delta alone). Close on the **materiality bar**: a pass yields
   no correctness, conformance, or security finding.

6. **Report** the verdict, the punch list, and - for any mechanizable finding - the fitness
   function that would retire its class. The success signal is *fewer findings next time*.

**Guardrails**
- Read-only on the code. The lenses critique; you (or the author) edit. A reviewer that writes is
  not a reviewer (a re-review subagent once ran drizzle-kit and corrupted the migration journal).
- Mechanizable findings (graph/structural properties) are closed by writing the fitness function,
  not by re-finding them. That is lens A's primary output.
- The custom agents (`static-composition`, `lifecycle-reachability`, `invariant-canon`, `chair`)
  are not available as agent types until a session reload. If dispatch by type fails, run each as
  a `general-purpose` agent carrying its persona from `.claude/agents/<name>.md` inline.
