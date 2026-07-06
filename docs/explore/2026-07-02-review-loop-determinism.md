# Explore: deterministic control for the review loop

- Date: 2026-07-02
- Decision: process/tooling change, implemented directly (no ADR - framework/tooling/process changes skip OPSX per CLAUDE.md). Mechanism documented in [../process/engineering.md](../process/engineering.md) (review-loop gate).
- Method: challenge session + web research

## Question

The definition of done says the review "loops, not one-shot": after applying review
fixes, re-run `verify` and re-review the fix delta; archive only once a pass finds
nothing material. Is that loop solid, or are we relying on a prose instruction the
LLM is trusted to follow?

## Key findings

Audit of the setup at the time: the loop **bodies** were half-deterministic
(`npm run verify`, CI) and the reviewers were separate agents (system-review lenses),
but the loop **control** - repeat, stop, count rounds - was 100% prose. No hooks
existed at project or user level; no iteration state was recorded anywhere; the exit
condition ("no material findings") was self-judged by the same session that wrote the
fixes. `verify-gate`'s `git hash-object` staleness check was the one deterministic
element, but its only consumer was the agent following instructions.

Recognized implementations put loop control in code:

- Anthropic's evaluator-optimizer workflow: the generate/evaluate loop and its
  max-iterations cap live in code; the evaluator is a separate LLM call.
- The Ralph Wiggum loop (Huntley; Anthropic ships an official plugin): continuation is
  enforced by a Stop hook that blocks session exit and re-feeds the prompt; exit is a
  completion-promise string plus a hard `--max-iterations` cap, with the docs warning
  to treat the deterministic cap as the primary mechanism.
- Research on LLM-judged completion: no judge configuration exceeded AUROC 0.65 at
  distinguishing false success from true success; the characteristic agent-loop
  failure is premature exit ("good enough"), not infinite looping.

Our exposure is exactly the premature-exit class: a review loop that runs once, finds
nothing material (self-graded), and archives - undetectably, because no round state
existed.

## Options considered

1. **Adopt the Ralph plugin wholesale** - rejected: it solves task persistence
   ("re-run until done"), not gate enforcement ("block closure until the exit was
   earned"), and would fight the OPSX workflow.
2. **Build a custom loop harness (bash while-loop / watcher)** - rejected: reinvents
   the commodity enforcement primitive Claude Code already ships (hooks); violates
   reuse-before-build.
3. **Hybrid: existing hook machinery + our own exit condition** - chosen. A
   PreToolUse hook (the same primitive the Ralph plugin uses) blocks
   `openspec archive` unless `scripts/review-loop.mjs check` passes: the last
   recorded review round is `clean` AND its content-addressed code-tree hash matches
   the current tree. Recording rounds (`npm run review:record`) doubles as the loop
   ledger, making round counts auditable.

## Outcome

`scripts/review-loop.mjs` (record / check / gate / stop) + PreToolUse and Stop hooks
in `.claude/settings.json`. The Stop hook is the loop's motor (same-day addendum -
the first cut built only the exit gate, but the ask was automating the *iterations*):
it blocks the agent from ending its turn while a loop is mid-flight (last round =
findings), so next rounds are machine-triggered; releases are a clean round, the
5-round escalation cap (the max-iterations bound), or an 8h staleness window. Any code edit after a clean round changes the tree hash and
re-blocks archive, so "re-review the fix delta" is mechanically required rather than
requested. Prose paths (`docs/`, `openspec/`, `.claude/`) are excluded from the hash
so recording a round or editing artifacts does not invalidate the round. The hash is
content-addressed over file contents, so commits do not invalidate a review. `verify`
enforcement stays with CI (the existing automatic backstop); this gate covers the
semantic review loop that CI cannot judge. The system-review loop (step 5 of
`/system-review`) remains convention: it has no closure event equivalent to archive
to hook, and its records already capture dispositions.

## Sources

- [Building Effective AI Agents - Anthropic](https://www.anthropic.com/research/building-effective-agents) (evaluator-optimizer pattern)
- [Ralph Wiggum plugin README - anthropics/claude-code](https://github.com/anthropics/claude-code/blob/main/plugins/ralph-wiggum/README.md) (Stop-hook loop, max-iterations as primary safety)
- [Ralph Wiggum as a "software engineer" - Huntley](https://ghuntley.com/ralph/)
- [From Confident Closing to Silent Failure: Characterizing False Success in LLM Agents, arXiv:2606.09863](https://arxiv.org/pdf/2606.09863) (judge AUROC <= 0.65 on false success)
- [How to Design Agent Loops with Verifiable Stop Conditions - MindStudio](https://www.mindstudio.ai/blog/agent-loops-verifiable-stop-conditions) (premature exit as the dominant failure)
