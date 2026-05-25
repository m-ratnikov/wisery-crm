## Why

The L1/L2 architecture and ADR-0001..0004 are settled, but no application code exists yet - and `package.json` even contradicts canon (it ships `better-sqlite3`, no `pg-boss`, no Postgres driver, while ADR-0001 says "SQLite is not used; managed Postgres + pg-boss in-process"). Before any feature, we need the walking skeleton the ADRs describe - a bootable runtime with config, Postgres, background jobs, and logging - so features hang on a proven foundation and ADR-0001/0004 are validated in running code, not just prose.

## What Changes

- **Project structure**: Next.js 16 App Router `src/` layout and the CLAUDE.md conventions - `src/lib/{config,db,jobs,log}`, `src/prompts/` (versioned), `server-only` on every server-only module, TypeScript strict.
- **Configuration**: a Zod-validated env module that fails fast at boot - the two Postgres connection strings (pooled app + direct pg-boss), provider/LLM API keys, runtime config - plus a committed `.env.example`. Secrets stay server-side.
- **Logging**: pino structured logging, `pino-pretty` in dev.
- **Data layer**: Drizzle on **node-postgres (`pg`)** for the pooled app connection; `drizzle-kit` migrations wired; an initial migration (the `pgboss` schema is created by pg-boss itself on start).
- **Background jobs**: pg-boss bootstrapped **in-process from `instrumentation.ts`** (`register()` -> `boss.start()`), behind a thin **pg-boss facade** (ADR-0004) holding its **own direct pool**; a SIGTERM/SIGINT handler calls `boss.stop({ graceful: true })` (ADR-0001).
- **Walking-skeleton smoke**: a health route plus a registered no-op cron job that proves the in-process worker actually runs; Vitest checks against the local Postgres.
- **Dependency reconciliation (cleanup)**: remove `better-sqlite3` + `@types/better-sqlite3` (contradict ADR-0001); add `pg` (+ `@types/pg`) and `pg-boss`.

## Capabilities

### New Capabilities
- `platform-runtime`: the process boots with validated config or fails fast; connects to Postgres via the pooled Drizzle connection; emits structured logs; drains in-flight work on graceful shutdown.
- `background-jobs`: durable background jobs on Postgres via in-process pg-boss - enqueue, process with retries and a dead-letter path, cron scheduling, and graceful drain - reached through the pg-boss facade (ADR-0001, ADR-0004).

### Modified Capabilities
<!-- none - no existing specs in openspec/specs/ yet -->

## Impact

- **Dependencies**: drop `better-sqlite3` (+types); add `pg` (+`@types/pg`) and `pg-boss`. `drizzle-orm`, `zod`, `pino`, `vitest` already present.
- **New code**: `src/` tree (`app/`, `lib/config`, `lib/db`, `lib/jobs`, `lib/log`), `instrumentation.ts`, `drizzle.config.ts` + `drizzle/` migrations, `.env.example`.
- **Dev environment**: a local Postgres on `localhost:5433` (developer-provided; real connection string in a gitignored `.env`, documented in `.env.example`).
- **Honors**: ADR-0001 (in-process pg-boss, two connection modes, graceful shutdown), ADR-0004 (pg-boss facade), and the CLAUDE.md stack/conventions. Next-specific code (`instrumentation.ts`) will be written against `node_modules/next/dist/docs/` per AGENTS.md, since the Next 16 register/runtime API differs from older versions.
- **Out of scope**: any domain entities/schema (arrive with features), the CQRS mediator (arrives with the first capability that needs it), the `EmailSender` stub (arrives with outreach), deployment topology (a later slice).
