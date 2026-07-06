@AGENTS.md

# Wisery CRM

We are building an AI-native agentic CRM for hyper personalized outreach.

Parent practice context: `D:\__softwisery\wisery\cto-practice\CLAUDE.md` (positioning, brand, decisions).

## Stack

TypeScript 5 strict, Node 22 LTS, Next.js 16 (App Router + Turbopack), React 19 (Server Components by default), Tailwind 4, Drizzle ORM + Postgres, Zod, pino, @anthropic-ai/sdk, Vitest. pg-boss job queue on Postgres, started in-process (no Redis). EmailSender interface (dev-stub for L1).

## Project rules (only what lint cannot enforce)

- No em-dashes in user-facing content or comments. Use short hyphens with spaces.
- Comment WHY, not WHAT. Default to no comments.
- Drizzle migrations are immutable once applied.
- Server Components by default. `'use client'` requires a reason.
- Prompts in `src/prompts/<name>_v<n>.ts` (versioned filenames for prompt_version traceability).
- LLM calls go through the `LLMProvider` port (LLM-agnostic, D9): use the provider's native structured-output mode, never `tool_use`, for any call returning data. For the default Anthropic adapter that is Anthropic Structured Outputs. (ADR-0003)
- In the Anthropic adapter, set `cache_control: { type: "ephemeral", ttl: "1h" }` explicitly for prompts over 1024 tokens (default TTL dropped to 5 min in March 2026); provider-specific optimizations like this live in the adapter, not in the port contract (ADR-0003).
- Use `server-only` import in any module that must never reach the client bundle.
- UI wireframes (clickable anchor-view mockups) live in `src/app/prototype/`; when you add, rename, or graduate a screen, update its `README.md` registry (the screen-to-capability join table that the architecture docs and capability specs link to). Convention and provenance: `docs/explore/2026-05-26-anchor-view-wireframes.md`.

## Engineering (definition of done)

- Reuse before build. Find and follow the existing pattern; do not add a parallel mechanism for config, data, jobs, or LLM. Read config via `src/lib/config`, data via `src/lib/db`, background work via the `src/lib/jobs` facade, LLM via the `LLMProvider` port. State in a change's design which existing modules/seams it reuses.
- Code is organised in vertical capability slices under `src/lib` (role-marker filenames like `*-view`/`*-map`/`*-queue`/`provider`/`pipeline`; domain files keep ubiquitous-language names). The L0 pure kernel, the jobs facade, and the adapter seams are build-enforced boundaries (dependency-cruiser). Convention and layering: `docs/process/module-conventions.md`.
- DRY is one authoritative representation per business rule, not textual sameness. Rule of three: tolerate the second occurrence, extract a shared abstraction only at the third (avoid premature abstraction).
- Done = `npm run verify` green (typecheck, lint, format, dependency-cruiser boundaries, jscpd duplication, per-file coverage, build) plus a `code-review` pass on the diff before archive. The review **loops, not one-shot**: after applying review fixes, re-run `verify` AND re-review the fix delta with full context (surrounding code, callers, the invariants it touches - not the diff alone); archive only once a pass finds nothing material. The loop is machine-driven, not self-judged: record every review round with `npm run review:record -- <change> --verdict clean|findings`; a Stop hook keeps the loop spinning while the last round has findings, and a PreToolUse hook blocks `openspec archive` until the last recorded round is clean and matches the current code tree (`scripts/review-loop.mjs`; releases: clean round, 5-round escalation cap, 8h staleness). Full posture, testing strategy + review checklist: `docs/process/engineering.md`; build order: `docs/roadmap.md`.

## Architectural thesis

Minimal interface + generative outputs. Anchor views exist only where the action is high-judgment (queue, prospect list, send approval). Everything else is generative or LLM-driven.

## Spec workflow

OpenSpec OPSX. Project-specific rules in `openspec/config.yaml` (auto-injected into every artifact generation). Use `/opsx:propose` for new changes, `/opsx:apply` to implement, `/opsx:archive` when done.

Two lanes, sized to the decision's weight (provenance: `docs/explore/2026-06-13-dev-process-optimization.md`, `docs/explore/2026-07-02-merge-tier-1-and-2.md`):

| Lane | Schema | Use when | Review |
|---|---|---|---|
| Default | `spec-driven-with-adr` (the configured default) | anything that is not an architecture change: bugfix, rename, copy fix, dead-code removal, a tweak inside existing architecture, OR a durable decision that fits an ADR + code. The `adr` step self-skips when no durable decision surfaces and writes one when it does. | `npm run verify` + `code-review` on the diff. IF the change wrote a NEW ADR: also a light gate on that ADR before archive (ledger + one `canon` reviewer + human sign-off); if that ADR supersedes an in-force ADR, the full `/verify-gate` panel instead. |
| Architecture | `spec-driven-architecture` (`--schema`) | the C4 views do real analytical work, OR it supersedes a load-bearing ADR, OR it drops/migrates data structurally, OR it introduces a new entity/boundary/port future changes will be constrained by, OR the owner flags it contested | full `/verify-gate` panel + canon promotion |

The trigger to leave the default lane for the architecture lane, concretely: supersedes an accepted ADR still in force, OR drops/reshapes persisted data, OR introduces a new entity/boundary/port that future changes will be constrained by, OR the owner flags it contested. When in doubt, stay in the default lane: it already records an ADR when one is warranted, and the ADR gate fires on that ADR. A default-lane ADR MUST carry a one-line "Canon impact" field (the canon sections it makes stale, or "none"); `/system-review` batch-reconciles that backlog. Framework/tooling/process changes skip OPSX entirely and are edited directly.

## Capture conventions

Keep research and decisions separate, both under `docs/`:
- Explore investigations (the research behind a decision): `docs/explore/YYYY-MM-DD-topic.md`. Method and note skeleton: `docs/explore/README.md`.
- Decisions: `docs/adr/NNNN-title.md`, lean Nygard format (Context, Decision, Consequences), written via the default `spec-driven-with-adr` schema (its adr step, when a durable decision surfaces) or the `spec-driven-architecture` schema; both are immutable and promote to `docs/adr/`. Supersede with a new ADR. Each ADR links to its explore note for provenance.
- North-star product overview: `docs/product-overview.md`.
- ADRs record decisions, not research logs; the investigation stays in `docs/explore/`.