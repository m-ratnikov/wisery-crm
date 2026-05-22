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
- Anthropic Structured Outputs over `tool_use` for any LLM call returning data.
- Set `cache_control: { type: "ephemeral", ttl: "1h" }` explicitly for prompts over 1024 tokens (default TTL dropped to 5 min in March 2026).
- Use `server-only` import in any module that must never reach the client bundle.

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