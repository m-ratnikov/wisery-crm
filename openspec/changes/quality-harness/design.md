## Context

The repo has `tsc` (strict), Vitest, and `next build`, and nothing else: no linter, no formatter, no coverage floor, no boundary enforcement, no CI. CLAUDE.md already says "only what lint cannot enforce" but no lint exists. This change closes that gap before feature code starts (roadmap change #0). It must pass against the existing backbone with no new feature code, and it adds zero product behavior.

Next 16 specifics (verified against `node_modules/next/dist/docs/.../05-config/03-eslint.md`): `next lint` and the `eslint` next.config option are removed in v16; linting is the ESLint CLI on a flat config. The recommended composition is `eslint-config-next/core-web-vitals` + `eslint-config-next/typescript` (which layers in typescript-eslint) + `eslint-config-prettier/flat`.

## Goals / Non-Goals

**Goals:**
- One `verify` command = the objective definition of done, runnable locally and in CI.
- Catch "broken" (types, lint, tests), guard "maintainable/robust" (boundaries, complexity), and keep formatting noise out of diffs.
- Encode the architecture's seams as build-failing rules that grow with the system.
- Make the gate unskippable (CI) and ensure DB/pg-boss tests actually run there.

**Non-Goals:**
- Certifying SOLID/DRY mechanically - those stay a review-pass judgment (the `code-review` skill). The harness only makes violations expensive and visible.
- Changing any architecture, ADR, or container. This is the code schema; the multi-agent verification gate does not apply.
- E2E/browser testing, performance budgets, mutation testing - later, if ever.

## Decisions

### D-A: ESLint flat config, not Biome
ESLint (`eslint.config.mjs`) composing `eslint-config-next/core-web-vitals`, `eslint-config-next/typescript`, `eslint-config-prettier/flat`, then typescript-eslint type-checked rules and our maintainability caps.
- *Why:* we specifically want type-aware rules (`no-floating-promises`, `no-misused-promises`, `await-thenable`) - exactly the bugs that bite an async pg-boss/Postgres codebase - plus the Next plugin's RSC/Next rules. Biome is faster and one tool but has no type-aware linting and no Next rules.
- *Type-aware:* enable typescript-eslint `recommendedTypeChecked` with `parserOptions.projectService: true` so rules see the type system. Config and test files must be in the TS project graph or they error.
- *Maintainability caps* (error-level): `complexity`, `max-depth`, `max-params`, `no-duplicate-imports`, plus `@typescript-eslint/no-explicit-any`. Tuned to pass the current backbone, then ratcheted.

### D-B: Prettier as the single formatting source of truth
Prettier formats; `eslint-config-prettier/flat` switches off every ESLint rule that would fight it (per the Next docs). CI runs `prettier --check`; local `format` runs `--write`.
- *Why:* removes formatting from review entirely and from ESLint's concern. Alternative (ESLint stylistic) keeps two opinions in tension.

### D-C: dependency-cruiser for architectural fitness functions
A separate `.dependency-cruiser.cjs` with `depcruise` in `verify`, not an ESLint import plugin.
- *Why:* dep-cruiser is graph-based and can assert *reachability*, not just direct imports - so "a `server-only` module must not be reachable from a `'use client'` module" is expressible, as are `no-circular` and `no-orphans`. ESLint import rules only see one file's direct imports.
- *Initial rules:* (1) `src/lib/**` must not depend on `src/app/**`; (2) `no-circular`; (3) nothing reachable from a `'use client'` module may transitively import `server-only`; (4) `src/lib/runtime/**` (Node-only bootstrap) is allowed only from `src/instrumentation.ts`. The ruleset is built to extend: when the D4/D9 ports land, add "adapters may import ports, never the reverse."

### D-I: Duplication and code-smell detection, tuned to the rule of three
Two tools, because textual duplication and design smells are different signals:
- `eslint-plugin-sonarjs` (flat config) for code smells as build errors: `no-identical-functions`, `no-duplicate-string`, `no-identical-expressions`, and `cognitive-complexity` (a better complexity signal than cyclomatic `complexity`, which we keep too).
- `jscpd` as a project-wide copy-paste gate (`dup` script, in `verify`): tokenizes `src/**`, fails over a configured duplication ratio.

The honest scope: this enforces only the *textual* half of DRY (copy-paste, identical bodies, repeated literals). The *knowledge* half - the same rule expressed two different ways - is not mechanically detectable and stays a review-checklist item (D-H).

**Tuning to the rule of three (the load-bearing decision here).** The duplication gate's job is to make copy-paste *visible*, not to mandate extraction. A threshold set too tight pushes toward premature abstraction - coupling unrelated code because it briefly looked alike - which is a worse defect than the duplication. So:
- jscpd `minTokens`/`minLines` are set to catch genuine duplicated blocks (a real copy-paste), and the failing ratio is set with headroom so two incidental similar fragments do not trip it.
- The resolution policy is the **rule of three**, written into `docs/engineering.md` and the review checklist: tolerate the second occurrence; extract a shared abstraction only at the third. A jscpd finding is a prompt to apply that judgment, not an automatic "extract now."
- *Alternative considered:* SonarQube/SonarCloud (server-side quality gate with a duplication %). Rejected as too heavy for a solo MVP; `eslint-plugin-sonarjs` gives most of the code-smell rules locally with no server, and jscpd covers the duplication %.

### D-D: Coverage via @vitest/coverage-v8, floor set at the current baseline, enforced per file
v8 provider, thresholds in `vitest.config.ts`, generated/config/stub files excluded.
- *Why a baseline-not-aspirational floor:* a floor above what the code actually has is performative - it gets disabled the first time it blocks. Measure the backbone's real coverage and set the floor at or just under it, then ratchet up in later changes. v8 over istanbul for speed (native).
- *Why per-file (`perFile: true`), not just global:* a single global threshold lets a new, untested module free-ride on the high coverage of everything else - so the gate passes while new code is uncovered. Per-file thresholds make each new module carry its own weight. (CI can additionally compute diff-coverage, but per-file is the native, local-and-CI-identical lever.)

### D-E: CI on GitHub Actions with a Postgres service container
`.github/workflows/ci.yml` runs `verify` on push and PR, with a `postgres` service and `TEST_DATABASE_URL` / `APP_DATABASE_URL` / `PGBOSS_DATABASE_URL` exported to the job.
- *Why:* the backbone's DB/pg-boss tests are integration tests by design (real round-trips) and skip when the URL is unset. Without a real Postgres in CI they silently skip and coverage collapses - the opposite of the gate's purpose. Mocking the DB would defeat the tests.

### D-F: verify ordering is fail-fast
`verify` = `tsc --noEmit` -> `eslint .` (includes sonarjs) -> `prettier --check` -> `depcruise src` -> `jscpd src` -> `vitest run --coverage` -> `next build`. Cheapest, most-likely-to-fail checks first; `next build` last (slowest).
- A fast local subset (`verify:fast` = tsc + eslint + vitest) is offered so the inner loop stays quick; full `verify` and CI run everything.

### D-G: Pre-commit is a fast subset, not full verify
husky + lint-staged run `eslint --fix` + `prettier --write` on staged files only.
- *Why:* commit-time must stay fast or it gets bypassed with `--no-verify`. The real gate is `verify` in CI; pre-commit is just early formatting/lint feedback. Husky is optional and can be dropped if it proves annoying.

### D-H: The review pass is process, run via the code-review skill with system context, against a written checklist
Documented in CLAUDE.md and `docs/engineering.md`, not wired into CI (it is judgment, not a binary check). It is run **with the architecture docs in context, not just the raw diff** - a diff-only review is inherently local and cannot see whether locally-fine code is wrong in the system. The checklist names what the gates cannot judge, so review is rigorous rather than vague:
- **Knowledge-DRY:** is any business rule or constant (for example the ICP score bar) defined in more than one place? A single authoritative representation is the test, not textual sameness.
- **Rule of three:** is a new shared abstraction being introduced at only the second occurrence? If so, prefer to leave the duplication until a third occurrence proves the shape. Conversely, is this the third copy of something jscpd flagged - time to extract.
- **Reuse and consistency (the "good locally, bad globally" check):** does this re-implement something that already exists? Does it follow the established pattern for this kind of work (config via the env module, data via the `db` module, background work via the jobs facade, LLM via the `LLMProvider` port), or introduce a *parallel* mechanism?
- **SOLID (the judgment parts):** does each module have one reason to change (SRP)? Naming and the right seam. (Dependency direction, the DIP part, is already enforced by dependency-cruiser, D-C.)
The one mechanizable SOLID principle - dependency inversion - lives in D-C; the rest live here.

### D-J: Shift-left - generation-time guidance, not just post-hoc gates
The gates catch problems after code exists; cheaper to bias the generator toward good code up front. Soft guidance (it shapes the output distribution, it does not guarantee - the gates remain the enforcement), placed at the two injection points this project actually has:
- **CLAUDE.md / AGENTS.md** (loaded into every apply/code-gen turn): a tight "Engineering principles + definition of done" block - reuse-before-build, the canonical patterns to follow, run `verify` and self-review before declaring done. Kept crisp on purpose; CLAUDE.md is loaded every turn and an essay dilutes attention.
- **`openspec/config.yaml`** (injected into artifact generation): the *design* rules gain a reuse-before-build / name-your-seam constraint, so every `design.md` is generated reuse-aware - the highest-leverage prevention, since `design.md` is where the design is decided before any code.

### D-K: Per-change gates plus a whole-system pass - scope is explicit
The mechanical gates run whole-tree (`tsc`, dependency-cruiser, jscpd, the full test suite, `next build`), so they already catch system-context regressions a diff-only view would miss - a new boundary violation against existing modules, cross-file duplication, a break in a consumer. What they cannot judge (architectural drift, whether an abstraction fits, spec/ADR conformance) is covered by process, at two cadences:
- **Per change:** `/opsx:verify` confirms the implementation matches `design.md` and honors the specs/ADRs, plus the D-H review pass.
- **Per milestone (M1, M2):** a whole-system review (point the architecture panel - atlas/canon - at the accumulated code) to catch drift that no single diff reveals. This is the global pass the per-change reviews structurally cannot be.

## Risks / Trade-offs

- **verify is slow (type-aware lint + next build).** -> Fail-fast ordering, a `verify:fast` subset locally, full run reserved for pre-push/CI.
- **Coverage floor becomes performative or, conversely, blocks legitimately uncovered infra.** -> Set at the measured baseline, exclude config/stubs/generated, ratchet deliberately in later changes; treat the number as a floor-not-a-target.
- **The duplication gate pushes toward premature abstraction (over-DRY).** A clustered abstraction coupling unrelated code is worse than the copy-paste it removed. -> Threshold tuned for genuine copy-paste with headroom (D-I); the rule of three is the written resolution policy, so a jscpd hit prompts judgment, not a reflex extraction. A second occurrence is allowed to stand.
- **type-aware linting errors on files outside the TS project (config, tests).** -> Ensure `parserOptions.projectService` and tsconfig `include` cover them, or scope type-checked rules to `src/**`.
- **dep-cruiser "reachable from client" is subtle and can be noisy.** -> Ship the high-confidence rules first (no `lib`->`app`, `no-circular`), add the `server-only`/client reachability rule carefully and verify it flags a deliberate violation before trusting it.
- **CI Postgres service drift from local `localhost:5433`.** -> CI sets its own URLs to the service; tests read them from env, so local vs CI differ only by connection string.
- **Config module format mismatch (ESM/CJS).** -> package.json has no `"type": "module"`, so the repo is CJS by default: `eslint.config.mjs` (ESM) and `.dependency-cruiser.cjs` (CJS) are each chosen to match their loader; `vitest.config.ts` stays TS.

## Migration Plan

1. Add devDeps and `lint` / `format` / `verify` / `verify:fast` scripts.
2. Add `eslint.config.mjs`, `.prettierrc` (+ ignore), `.dependency-cruiser.cjs`, coverage config in `vitest.config.ts`.
3. Run `verify` against the backbone; fix any findings in existing code (formatting, lint). Measure coverage, set the floor.
4. Add `.github/workflows/ci.yml` with the Postgres service; confirm DB/pg-boss tests run (not skip) and CI is green.
5. Add husky + lint-staged (optional). Update CLAUDE.md (definition of done) and add `docs/engineering.md`.
6. Prove a deliberately-introduced lint error and a boundary violation each fail `verify`, then revert them.

Rollback: revert the change. No runtime or data impact - this is tooling only.

## Open Questions

- Exact coverage floor number (resolved during step 3 against the measured baseline).
- Keep `next build` inside `verify` or CI-only? (Leaning: in `verify` but documented as the slow step; revisit if the inner loop suffers - `verify:fast` covers the common case.)
- Keep husky, or rely on CI + editor integration only?
