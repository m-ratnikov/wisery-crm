---
name: "Verify Gate"
description: Run the verification gate (groundedness + design challenge + synthesis) on a spec-driven-architecture artifact and write a verification record. Architecture artifacts only - not the default code schema.
category: Architecture
tags: [architecture, verification, review, hallucination]
---

Run the verification gate (`docs/verification-gate.md`) on a named architecture artifact and write
a verification record. This is the gate that the change's section-0 promotion tasks require.

**Input**: an artifact path, or a change name. If omitted, default to the active change's
`system-design.md`.

**Scope guard (first step)**: this gate is for `spec-driven-architecture` artifacts only
(proposal, use-cases, domain-model, system-design, deployment, adr). If pointed at a default
`spec-driven` (code) artifact, STOP and say so - code is verified by typecheck/tests/lint, not by
this gate.

**Steps**

1. **Classify stakes.** High-stakes = an ADR draft (`adr/*.md`) or any artifact whose promotion
   writes immutable canon. Otherwise low-stakes. This decides whether human sign-off is mandatory.

2. **Stage 1 - Ground.** Dispatch the `ledger` agent on the artifact. If its gate call is
   `blocked` (any unsupported fact, underivable claim, untagged claim, or unfalsifiable novel
   claim), STOP here and report the blockers - do not run the panel on ungrounded content. The
   author fixes, then re-run.

3. **Stage 2 - Challenge.** Only if Stage 1 is `clean`, dispatch the panel lineup for the artifact
   type (run in parallel):
   - `system-design` -> atlas, greybeard, pedant, canon
   - `adr` -> canon, atlas, greybeard
   - `domain-model` -> atlas, canon, pedant
   - other -> canon
   See `docs/review-panel.md`.

4. **Stage 3 - Synthesize.** Dispatch `chair` with the ledger plus the panel findings. Capture its
   single verdict (`ship` / `ship-with-fixes` / `rework`) and headline.

5. **Write the record** to `openspec/changes/<change>/verification.md`:
   - the artifact(s) covered, each with `git hash-object <artifact>` captured now;
   - the Stage-1 ledger summary (confirm no blockers);
   - the Chair verdict + headline + the triaged punch list;
   - a human sign-off line. For high-stakes artifacts leave it `- [ ] sign-off: PENDING (human)` -
     do NOT self-sign; a human must check this box.

6. **Report** pass/fail. **Pass** = Stage 1 `clean` + Chair verdict not `rework` + (high-stakes)
   sign-off line present for a human to complete.

**Guardrails**
- Read-only on the artifact. The gate critiques; the author edits. Never edit the artifact to make
  it pass.
- Facts are verified against sources, never plausibility (the pg-boss lesson).
- The record's `git hash-object` ties it to exact content. Re-run after ANY edit to the artifact, or
  the promotion task must treat the record as stale.
- The custom agents (`ledger`, `atlas`, `greybeard`, `pedant`, `canon`, `chair`) are not available
  as agent types until a session reload. If dispatch by type fails, run each as a `general-purpose`
  agent carrying its persona from `.claude/agents/<name>.md` inline.
