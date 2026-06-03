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
- DRY is one authoritative representation per business rule, not textual sameness. Rule of three: tolerate the second occurrence, extract a shared abstraction only at the third (avoid premature abstraction).
- Done = `npm run verify` green (typecheck, lint, format, dependency-cruiser boundaries, jscpd duplication, per-file coverage, build) plus a `code-review` pass on the diff before archive. The review **loops, not one-shot**: after applying review fixes, re-run `verify` AND re-review the fix delta with full context (surrounding code, callers, the invariants it touches - not the diff alone); archive only once a pass finds nothing material. Full posture: `docs/roadmap.md`; testing strategy + review checklist: `docs/engineering.md`.

## Architectural thesis

Minimal interface + generative outputs. Anchor views exist only where the action is high-judgment (queue, prospect list, send approval). Everything else is generative or LLM-driven.

## Spec workflow

OpenSpec OPSX. Project-specific rules in `openspec/config.yaml` (auto-injected into every artifact generation). Use `/opsx:propose` for new changes, `/opsx:apply` to implement, `/opsx:archive` when done.

## Capture conventions

Keep research and decisions separate, both under `docs/`:
- Explore investigations (the research behind a decision): `docs/explore/YYYY-MM-DD-topic.md`. Method and note skeleton: `docs/explore/README.md`.
- Decisions: `docs/adr/NNNN-title.md`, lean Nygard format (Context, Decision, Consequences) via the `spec-driven-with-adr` schema. Accepted ADRs are immutable; supersede with a new ADR. Each ADR links to its explore note for provenance.
- North-star product overview: `docs/product-overview.md`.
- ADRs record decisions, not research logs; the investigation stays in `docs/explore/`.