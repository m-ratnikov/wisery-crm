---
name: "Arch Links"
description: Run the spec -> architecture link validator and report or fix broken/missing references
category: Architecture
tags: [architecture, specs, validation]
---

Run the spec -> architecture link validator and report the result.

This is the manual enforcement of the one-way spec -> architecture reference convention
(`docs/architecture/README.md`). The `## Architecture` section is optional; this check verifies
that when a canonical spec (`openspec/specs/<capability>/spec.md`) HAS one, every local link in
it resolves to a real file. It checks that pointers exist, never that the linked content agrees -
that stays human review.

**Steps**

1. Run the validator (target the file directly so unrelated app tests do not affect this check):
   ```bash
   npx vitest run tests/arch-links.test.ts
   ```

2. **If it passes**, report briefly: every canonical spec has its `## Architecture` section and
   all links resolve. Stop here.

3. **If it fails**, the failure is always a **broken link** - a spec's `## Architecture` section
   names a target that does not resolve. (A missing `## Architecture` section is NOT a failure;
   the section is optional.) Find where the file actually is now (most often it moved to
   `docs/architecture/areas/<area>/...` after a flat-to-area split) and update the link; if the
   doc was deleted, repoint it (for example to the `docs/product-overview.md` spine) or remove it.

4. For each broken link, propose the corrected target. Apply an unambiguous fix (a clear file
   move/rename) directly with Edit; if the right target is genuinely ambiguous, use the
   AskUserQuestion tool before editing.

5. After any edits, re-run the validator and confirm it is green.

**Guardrails**
- Never edit anything under `docs/adr/` to satisfy a link - ADRs are immutable. Fix the link.
- Never weaken or skip the test to make it pass. A spec with no genuine architectural home is a
  signal to discuss, not to silence.
