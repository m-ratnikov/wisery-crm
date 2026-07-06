# Wisery CRM

An AI-native, agentic CRM for hyper-personalized outreach. One system of record and one
pipeline that replaces a multi-tool stack (Make.com + Airtable + Zapier + Octopus +
Breakcold) for freelancers, solopreneurs, builders, consultants, and fractional CTOs/CXOs.

> North-star product overview: [`docs/product-overview.md`](docs/product-overview.md).
> Working agreement for humans and agents: [`CLAUDE.md`](CLAUDE.md) and [`AGENTS.md`](AGENTS.md).

## Thesis

- **Automate the intelligence, keep the action human.** The system finds, qualifies,
  enriches, personalizes, and tracks. The human still clicks send - the system never sends
  on its own.
- **Minimal interface + generative outputs.** Hand-built "anchor views" exist only where
  judgment lives: ICP/profile config, the prospect list, and the review/approve queue.
  Everything else is background jobs and generative output.
- **Built single-user first, multi-tenant by construction.** Everything personal to one
  operator (ICP, profile, voice, case studies) is per-tenant configuration-as-data, not
  hardcoded. Tenant #1 is just the first config.
- **Quality over volume is a feature.** "10 genuine relationships > 250 automated messages."

### The pipeline

A scraped or entered person becomes a prospect that flows through the stages below. One
upstream signal can fan out to many prospects (the core domain cardinality).

```
signal scan ──▶ qualify (score vs ICP rubric) ──▶ draft ──▶ review & approve (human acts)
                      │
                      └─(opt-in)─▶ enrich (dossier) ──▶ re-draft
```

Stages run as durable background jobs; handoffs between them are enqueued inside the
same database transaction as the stage's state write, so a stage and its follow-on commit
together or not at all (no half-finished "strand" states).

## Tech stack

| Area | Choice |
|---|---|
| Language / runtime | TypeScript 5 (strict), Node 22 LTS |
| Framework | Next.js 16 (App Router + Turbopack), React 19 (Server Components by default) |
| Styling | Tailwind CSS 4 |
| Data | Drizzle ORM + managed Postgres |
| Background jobs | pg-boss, run in-process via `instrumentation.ts` (no Redis, no separate worker process by default) |
| Validation | Zod | 
| LLM | `@anthropic-ai/sdk` behind an `LLMProvider` port (LLM-agnostic) |
| Logging | pino |
| Tests | Vitest (+ Stryker for mutation testing) |

> This is **not** the Next.js most training data knows - Next 16 has breaking changes.
> Read the relevant guide under `node_modules/next/dist/docs/` before writing app code
> (see [`AGENTS.md`](AGENTS.md)).

## Repository layout

```
src/
  app/
    (app)/            Wired, signed-in app (route group; the sidebar shell lives here)
      icp-config/       Anchor view #1 - ICP rubric, profile, signal sources
      prospect-list/    Anchor view #3 - the lead list + detail
      review-queue/     Anchor view #2 - review draft, act manually, log outcome
      jobs/             Operations view - read-only background-job monitor
      settings/         Per-tenant settings (e.g. auto-enrich)
    api/              Route handlers (health, jobs activity poll)
    prototype/        Clickable low-fi wireframes (mock data, no db/jobs). See its README.
  lib/
    config/  db/  log/        Config (Zod env), Drizzle data layer, pino logger
    jobs/                      pg-boss facade (enqueue, work, schedules, activity read-model)
    runtime/                   Composition root: bootstrapNodeRuntime() wires workers
    signals/                   Source connectors + scan pipeline (signal ingestion)
    qualify/  enrich/  draft/  The pipeline stages (each a queue + worker + core logic)
    prospect/  queue/  icp/    Read models + domain helpers
    llm/                       LLMProvider port + Anthropic adapter + fake
docs/
  product-overview.md   North-star spine the scoped changes hang off
  architecture/         C4 views, domain model, glossary, cross-cutting, canon manifest
  adr/                  Accepted Architecture Decision Records (immutable)
  explore/              Research notes behind decisions (provenance)
  engineering.md        The verify gate + testing strategy + review checklist
  roadmap.md            Milestone + verification posture
  reviews/              Whole-system review reports
openspec/
  specs/                Canonical capability specs (the current contract)
  changes/              In-flight changes; changes/archive/ holds completed ones
  schemas/              The OPSX workflow schemas (see below)
  config.yaml           Project-specific OPSX rules (injected into every artifact)
drizzle/                Generated SQL migrations + snapshots (immutable once applied)
tests/                  Vitest suites (mirror the capabilities)
```

## Getting started

### Prerequisites

- Node 22 LTS and npm
- A reachable Postgres instance (dev uses `localhost:5433`). The app and pg-boss can share
  one database.

### Environment

Create `.env` (git-ignored). Variables are parsed and validated by
[`src/lib/config/env.ts`](src/lib/config/env.ts) - the app fails fast at boot on bad config.

```bash
APP_DATABASE_URL=postgres://user:pass@localhost:5433/wisery   # required
PGBOSS_DATABASE_URL=                                          # optional; defaults to APP_DATABASE_URL
APP_DB_POOL_MAX=10                                            # optional
PGBOSS_DB_POOL_MAX=5                                          # optional
LOG_LEVEL=info                                                # optional
ANTHROPIC_API_KEY=                                            # needed for LLM qualify/draft
APIFY_API_TOKEN=                                              # needed for enrichment scraping
# For the test suite (db + pg-boss tests connect for real):
TEST_DATABASE_URL=postgres://user:pass@localhost:5433/wisery_test
```

### Run

```bash
npm install
npm run db:migrate     # apply Drizzle migrations
npm run dev            # http://localhost:3000  (wired app)
```

The clickable wireframe prototype lives at `/prototype` (mock data, no DB needed).

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Next dev server (Turbopack) |
| `npm run build` / `start` | Production build / serve |
| `npm run verify` | **Definition of done.** Full gate (see below) |
| `npm run verify:fast` | Inner loop: typecheck + lint + tests |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` / `lint:fix` | ESLint (type-aware + cognitive-complexity) |
| `npm run format` / `format:check` | Prettier |
| `npm run depcruise` | dependency-cruiser architectural boundaries |
| `npm run dup` | jscpd duplication |
| `npm run test` / `test:cov` | Vitest / with per-file coverage floor |
| `npm run test:mutation` | Stryker mutation testing |
| `npm run db:generate` / `db:migrate` | Drizzle: generate a migration / apply migrations |

### The verify gate

`npm run verify` is the definition of done for every change. It runs fail-fast, **whole-tree**
(not over the diff, so it catches system-context regressions):

1. `tsc --noEmit` - types
2. `eslint .` - lint (type-aware rules + nesting-aware cognitive complexity)
3. `prettier --check .` - formatting
4. `depcruise src` - architectural boundaries (e.g. ports, server-only residency)
5. `jscpd src` - duplication
6. `vitest run --coverage` - tests + per-file coverage floor
7. `next build` - the app builds

`verify` needs a reachable test Postgres (the DB and pg-boss tests connect for real). Details
and the testing strategy: [`docs/process/engineering.md`](docs/process/engineering.md).

## Spec-driven development (OpenSpec OPSX)

This repo is **spec-driven**: a feature is proposed and specified before it is implemented,
and the specs are living artifacts that travel with the code. The tooling is OpenSpec (OPSX).

### The flow

```
/opsx:propose  ──▶  /opsx:apply  ──▶  /opsx:archive
   (draft)            (implement)        (promote specs, file the change)
```

1. **Propose** (`/opsx:propose`) scaffolds a change under `openspec/changes/<name>/` and
   generates its artifacts in dependency order. The default `spec-driven-with-adr` schema produces:
   - `proposal.md` - **why** + **what changes** + which capabilities are new vs modified
   - `specs/<capability>/spec.md` - **what** (the contract), as requirement + scenario deltas
   - `design.md` - **how** (decisions, alternatives, risks, trade-offs)
   - `adr` - a decision record in `docs/adr/`, but only when a durable decision surfaces (the step self-skips otherwise)
   - `tasks.md` - the implementation checklist the apply phase tracks
2. **Apply** (`/opsx:apply`) implements `tasks.md`, checking items off as it goes, under the
   verify gate.
3. **Archive** (`/opsx:archive`) promotes the change's spec deltas into the canonical
   `openspec/specs/`, then moves the change to `openspec/changes/archive/`.

Useful CLI: `openspec status --change <name>`, `openspec validate <name>`,
`openspec instructions <artifact> --change <name>`.

### Specs are a contract, not prose

Each capability has one canonical spec at `openspec/specs/<capability>/spec.md`. Requirements
use normative language and at least one scenario:

```
### Requirement: <name>
The system SHALL <observable, user-facing behavior>.

#### Scenario: <name>
- **WHEN** <condition>
- **THEN** <expected outcome>
```

A change ships **deltas** (`## ADDED` / `## MODIFIED` / `## REMOVED` / `## RENAMED`
Requirements) against those canonical specs; archive folds the deltas in. Project-specific
authoring rules (requirements describe behavior not mechanics; four-hashtag scenarios; the
optional `## Architecture` link section) live in [`openspec/config.yaml`](openspec/config.yaml)
and are injected into every artifact generation.

### Decisions, ADRs, and research

- **Decisions** are Architecture Decision Records in [`docs/adr/`](docs/adr/), lean Nygard
  format (Context, Decision, Consequences). **Accepted ADRs are immutable** - you supersede
  one with a new ADR, you do not edit it. The default `spec-driven-with-adr` schema writes an
  ADR inline whenever a durable decision surfaces and promotes it to `docs/adr/`; the heavier
  `spec-driven-architecture` schema (run with `--schema spec-driven-architecture`) also writes
  ADRs alongside its C4 views. **An agent must not self-accept an ADR** - promotion to
  `Status: accepted` is a human sign-off.
- **Research** behind a decision lives separately in [`docs/explore/`](docs/explore/)
  (`YYYY-MM-DD-topic.md`). Each ADR links its explore note for provenance. ADRs record
  decisions, not research logs.
- **The spine** every scoped change hangs off is [`docs/product-overview.md`](docs/product-overview.md);
  the C4 views, domain model, and glossary are under [`docs/architecture/`](docs/architecture/).

### When NOT to use OPSX

Tooling, process, and framework work (build config, CI, lint rules, the harness itself) is
edited directly - it does not route through the spec artifact cascade. The OPSX flow is for
product capabilities.

### Definition of done

A change is done when `npm run verify` is green **and** a `code-review` pass on the diff finds
nothing material. The review **loops**: after applying fixes, re-run `verify` and re-review the
fix delta with full context (callers, invariants, surrounding code), not the diff alone.
Archive only once a pass is clean. Reviewers are read-only - they critique, they do not edit.

### Wireframes registry

Clickable low-fi wireframes under [`src/app/prototype/`](src/app/prototype/) settle UX before
a screen is wired. Its [`README.md`](src/app/prototype/README.md) is the join table mapping
screens to capabilities, which the architecture docs and capability specs link to. Keep it
current when you add, rename, or graduate a screen.

## Project conventions (the ones lint cannot enforce)

- No em-dashes in user-facing content or comments. Use short hyphens with spaces.
- Comment **why**, not what. Default to no comments.
- Drizzle migrations are immutable once applied; a change means a new migration.
- Server Components by default; `'use client'` needs a stated reason. Use `server-only` in
  any module that must never reach the client bundle.
- LLM calls go through the `LLMProvider` port using the provider's native structured-output
  mode (Anthropic Structured Outputs), never `tool_use`, for any call returning data. Prompts
  live in `src/prompts/<name>_v<n>.ts` (versioned for `prompt_version` traceability).
- Reuse before build: config via `src/lib/config`, data via `src/lib/db`, background work via
  the `src/lib/jobs` facade, LLM via the `LLMProvider` port. Do not add a parallel mechanism.

## Status

Single-user MVP. Authorization is deliberately deferred (D1): Server Actions and the read
endpoints are currently unauthenticated and must have authz added at the productization
milestone. There is no production deploy today.
