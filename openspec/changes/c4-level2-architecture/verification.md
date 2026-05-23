# Verification record - c4-level2-architecture

Produced by `/verify-gate` (docs/verification-gate.md). **Run 3** (2026-05-23) - after the LLM +
JobQueue follow-up passes and a full fix cycle against Run 2's `rework`. Runs 1 (inaugural PASS) and
2 (rework) are superseded by this record.

## Coverage

- **Artifact:** `openspec/changes/c4-level2-architecture/system-design.md`
- **Content hash (git hash-object):** `3768322ea4ef8c15528aacdf746c4426240be1d7`
- **Date:** 2026-05-23
- Stakes: **high** (promotes to docs/architecture/ canon; rides with ADR-0002/0003/0004 -> docs/adr/).
- Re-run after any edit; if the hash changes, this record is stale.
- Also touched this cycle: `adr/0003-llm-provider-port.md`, `adr/0004-pg-boss-facade.md` (renamed from
  `0004-jobqueue-port.md`), and canon: `CLAUDE.md` (LLM rule -> port + native mode), `docs/product-overview.md`
  (added D9 LLM-agnostic, D10 PII attach point).

## Stage 1 - Ground (Ledger): clean (after one fix cycle)

Focused re-sweep of the new/changed claims (the prior 48 supported claims unchanged). Initial call
**blocked** on one factual error the author had introduced while resolving Run 2's M10: "GA Nov 2025"
for Anthropic Structured Outputs. The ledger checked Anthropic release notes against the installed SDK
CHANGELOG and found Nov 2025 = public beta (`output_format`), GA = 2026-01-29 (SDK v0.72.0,
`output_config.format`). Fixed to "GA January 2026, public beta November 2025"; Greybeard independently
re-verified the corrected dates against `@anthropic-ai/sdk` 0.97.0. All other new claims (Graphile
Worker transactional enqueue + cron; Anthropic keyword rejections; D9/D10 derivations; CLAUDE.md
update) supported. **Stage 1: clean.**

## Stage 2 - Challenge (panel): all four ship-with-fixes

All of Run 2's findings (incl. the Canon B1 blocker) confirmed **resolved**.

- **Atlas:** A1 (LLM driver now D9-locked), A2 (port -> honest pg-boss facade), A3/M5 (ports tiered),
  A4/M8 (port names off the diagram), A5/M2 (no ADR-0001 amendment) - resolved. Residual: L1/L2 LLM
  label contradiction (minor, promotion-time).
- **Greybeard:** F3/M3 (Graphile Worker now in the survey; transactional enqueue correctly framed as a
  Postgres-queue property), F4/M4 (two-layer validation), F6/M11 (ratio dropped), F7/M12 (retired by the
  facade reframing), GA date corrected & verified. New N1 (minor): the 400 risk was overstated - the
  installed SDK's `zodOutputFormat` transform already does the subset-strip + local Zod validation.
- **Pedant:** P1/M6 (legend), P2/M7 (Postgres-internal defended on the ownership axis), P5/M8
  (stereotype) - resolved. New Finding 1 (major): the `app->db` edge collapsed two channels; plus
  sequence-diagram edges missing protocols (minor/nit).
- **Canon:** C1/B1 blocker (CLAUDE.md updated + D9 locked) - resolved; C3/M2 (no ADR-0001 amendment) -
  resolved; C4/M9 (D10 recorded) - resolved. Open process gate: ADR-0002/0003/0004 still `proposed`.

### Fixes applied this cycle (verified real by the Chair against the current artifact)

- Greybeard N1: ADR-0003 + system-design now state the two-layer split is the SDK's behavior on the
  default adapter; the 400 risk is scoped to the raw `messages.create` path and non-Anthropic adapters.
- Pedant Finding 1: split the `app->db` edge into two ("app queries ... pooled endpoint" / "jobs ...
  direct pg-boss pool"); Decisions prose updated to "two edges to the single datastore."
- Pedant Findings 2-5: added protocols to the SRC/DP/LLM/browser edges in both sequence diagrams
  ((HTTPS), (HTTPS, carries PII), (HTTPS / RSC)).

## Stage 3 - Synthesize (Chair)

**Verdict: ship-with-fixes.** No live contradictions remain; the B1 blocker and all rework findings are
resolved in-text; the applied punch-list fixes are real. The only thing between this and a clean `ship`
is the mechanical promotion gate of accepting the three proposed ADRs - a process action, not an
artifact defect.

### Remaining before promotion

**True promotion gates (clear at `/opsx:archive`; do NOT block this verdict):**
1. Move **ADR-0002/0003/0004** to `Status: accepted` and promote to `docs/adr/` (they are cited as
   settled authority throughout).
2. **L1/L2 reconciliation**: update promoted `docs/architecture/system-context.md` - the LLM box still
   reads "LLM API - Anthropic" (now contradicts D9 + the L2 view) and the header says "D1-D8" (now
   D1-D10). Deferred per the user's instruction to leave promoted L1 alone; do it with the promotion
   commit so canon does not ship internally inconsistent.

**Optional / deferred (none block):**
- CQRS-as-in-process-mediator -> its own ADR-0005 (currently in ADR-0004 Context; adequate for L2). User
  explicitly deferred CQRS as an L3 decision.
- ADR-0001 shutdown-handler registration site (Greybeard N2, nit) - L3 detail, confirm at M0.

## What the gate caught across the three runs (value record)

- Run 2 Ledger: two factual over-compressions ("@platformatic Redis-only"; "no mature agnostic queue").
- Run 2 Canon: **blocker** - a proposed ADR silently generalizing a CLAUDE.md canon rule.
- Run 2 Greybeard: the Graphile Worker omission (refuting the "transactional enqueue is pg-boss's
  distinguishing property" crux) and the Anthropic-rejects-idiomatic-Zod 400 risk.
- Run 3 Ledger: a wrong GA date the author introduced while fixing a Run 2 item.
- Run 3 Greybeard: an *overstatement* in that same fix (the SDK transform already handles the subset).
  Several of these were confident, fluent, and wrong - caught only by source-reading, not plausibility.

## Sign-off

- [x] sign-off: **Michael Ratnikov, 2026-05-23** (human-confirmed via "let's apply"). High-stakes
  artifact; promotion still requires accepting ADR-0002/0003/0004 and the L1 reconciliation at archive.

**Gate call: PASS (human sign-off recorded 2026-05-23).** Stage 1 clean, Stage 3 verdict ship-with-fixes (not
rework), no unsupported claims and no unresolved blocker. Promotion additionally requires accepting
ADR-0002/0003/0004 and the L1 reconciliation at `/opsx:archive`. The artifact was NOT edited to pass
during a gate run - all fixes were authored between runs against the panel's findings.
