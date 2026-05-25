## Why

Feature code is about to start flowing (roadmap.md M1), but the repo has no objective quality bar: no linter, no formatter, no coverage floor, no architectural-boundary enforcement, no CI. OpenSpec verifies that code matches the spec; it does not verify that the code is clean, well-factored, tested, or architecturally sound. Without machine-checkable gates, "robust, maintainable, SOLID/DRY, tested, not broken" degrades to hope - and degrades fastest when an agent is generating the code. This change stands up those gates first (roadmap change #0), proven green against the existing backbone, so every later change inherits them.

## What Changes

- Add **ESLint** (flat `eslint.config.mjs`): `eslint-config-next/core-web-vitals` + `eslint-config-next/typescript` + `eslint-config-prettier/flat`, plus typescript-eslint type-aware rules (`no-floating-promises`, `no-misused-promises`, `await-thenable`) and maintainability caps (complexity, depth, params, no-duplicate-imports). `next lint` is removed in Next 16, so linting is the ESLint CLI directly.
- Add **duplication and code-smell detection**: `eslint-plugin-sonarjs` (`no-identical-functions`, `no-duplicate-string`, `cognitive-complexity`) plus `jscpd` as a copy-paste gate. The jscpd threshold is tuned to surface genuine copy-paste, deliberately NOT to force extraction of incidental similarity (see the rule of three below). This is the textual half of DRY; the knowledge half stays a review concern.
- Add **Prettier** as the single formatting source of truth, reconciled with ESLint via `eslint-config-prettier`.
- Add **Vitest coverage** (`@vitest/coverage-v8`) with a realistic floor configured in `vitest.config.ts`.
- Add **dependency-cruiser** as architectural fitness functions: build-failing rules that encode our seams (no `src/lib` -> `src/app` imports, no cycles, `server-only` modules unreachable from client code, the Node-only bootstrap reached only via the instrumentation dynamic import). The ruleset is designed to grow as ports/adapters land.
- Add a single **`verify`** npm script (`tsc` + ESLint + Vitest-with-coverage + dependency-cruiser + `next build`) as the definition of done for every change.
- Add **GitHub Actions CI** running `verify` on every push and PR, with a **Postgres service container** so the DB and pg-boss tests run in CI instead of skipping.
- Adopt the **`code-review` skill** as the human-judgment review pass, run **with architecture context** (not the diff alone, which is inherently local), against a written checklist covering what tools cannot judge: knowledge-duplication (DRY), reuse/pattern-consistency, SOLID, naming, and the **rule of three** (do not extract a shared abstraction until the third occurrence).
- Define the enforcement **cadence**: per-change conformance (`/opsx:verify` against design + ADRs) plus a **whole-system review at milestone boundaries** to catch architectural drift the gates and per-change reviews cannot see.
- Add **generation-time (shift-left) guidance** so good code is biased up front, not only gated after: a tight "Engineering principles + definition of done" block in **CLAUDE.md** (reuse-before-build, the canonical patterns, run `verify` before done), and a reuse-before-build / name-your-seam constraint in **`openspec/config.yaml`** design rules so every `design.md` is generated reuse-aware.
- Add **docs/engineering.md** for the testing strategy, the boundary-ruleset rationale, and the DRY/SOLID review checklist (including the rule of three).

This change adds no product behavior and must not require any feature code to pass.

## Capabilities

### New Capabilities
- `code-quality`: the repository's enforceable quality contract - a single `verify` gate (type-check, lint, formatted, tested above a coverage floor, architectural boundaries intact, builds) that every change must pass, enforced locally and in CI, plus a documented review pass.

### Modified Capabilities
<!-- None. No existing capability's requirements change; this adds a new one. -->

## Impact

- **New files:** `eslint.config.mjs`, `.prettierrc` (+ `.prettierignore`), `.dependency-cruiser.cjs`, `.github/workflows/ci.yml`, `docs/engineering.md`; optional `.husky/` + `.lintstagedrc`.
- **Modified:** `package.json` (devDeps: eslint, eslint-config-next, eslint-config-prettier, typescript-eslint, eslint-plugin-sonarjs, jscpd, prettier, @vitest/coverage-v8, dependency-cruiser, optionally husky + lint-staged; scripts: `lint`, `format`, `dup`, `verify`), `vitest.config.ts` (per-file coverage), `CLAUDE.md` (engineering principles + definition of done), `openspec/config.yaml` (reuse-before-build design rule). New: `.jscpd.json`.
- **Honors:** the `spec-driven` code schema (this is not an architecture change and does not touch ADRs or the C4 view, so the multi-agent verification gate does not apply). Existing tests, `arch-links`, and `mermaid` tests must stay green; the existing backbone must pass `verify` with no new feature code.
- **Risk:** type-aware linting and `next build` make `verify` slower than `tsc` alone; mitigated by keeping the heavy steps in CI and offering a fast local subset. CI requires a Postgres service or the gated tests skip and coverage drops.
