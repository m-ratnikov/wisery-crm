## 1. Dependencies and scripts

- [ ] 1.1 Add devDeps: `eslint`, `eslint-config-next`, `eslint-config-prettier`, `typescript-eslint`, `eslint-plugin-sonarjs`, `jscpd`, `prettier`, `@vitest/coverage-v8`, `dependency-cruiser` (and `husky` + `lint-staged` if pre-commit is kept).
- [ ] 1.2 Add npm scripts: `lint` (`eslint .`), `format` (`prettier --write .`), `format:check` (`prettier --check .`), `depcruise` (`depcruise src`), `dup` (`jscpd src`), `verify`, and `verify:fast` (per design D-F ordering).

## 2. ESLint (flat config)

- [ ] 2.1 Create `eslint.config.mjs`: `eslint-config-next/core-web-vitals` + `eslint-config-next/typescript` + `eslint-config-prettier/flat`, with `globalIgnores` for build/output dirs.
- [ ] 2.2 Enable typescript-eslint type-aware rules via `parserOptions.projectService`; confirm config/test files are in the TS project graph (or scope type-checked rules to `src/**`).
- [ ] 2.3 Add error-level maintainability rules: `complexity`, `max-depth`, `max-params`, `no-duplicate-imports`, `@typescript-eslint/no-explicit-any`, `@typescript-eslint/no-floating-promises`, `no-misused-promises`, `await-thenable`. Tune thresholds so the existing backbone passes.

## 3. Prettier

- [ ] 3.1 Add `.prettierrc` and `.prettierignore`; confirm no rule conflicts with ESLint (covered by `eslint-config-prettier/flat`).
- [ ] 3.2 Run `format` once over the repo so the baseline is clean; confirm `format:check` is green.

## 4. Duplication and code smells

- [ ] 4.1 Add `eslint-plugin-sonarjs` to the flat config (error-level): `no-identical-functions`, `no-duplicate-string`, `no-identical-expressions`, `cognitive-complexity` (keep cyclomatic `complexity` too). Tune thresholds so the backbone passes.
- [ ] 4.2 Add `.jscpd.json` and the `dup` script: scan `src/**`, set `minTokens`/`minLines` for genuine copy-paste, set the failing duplication ratio with headroom so incidental similarity does not trip it (per design D-I, the rule of three governs extraction - the gate only surfaces).
- [ ] 4.3 Confirm `dup` is green on the backbone; record the chosen threshold and its rationale in `docs/engineering.md`.

## 5. Coverage floor

- [ ] 5.1 Configure `@vitest/coverage-v8` thresholds in `vitest.config.ts` with `perFile: true` so a new untested module cannot hide behind global coverage; exclude config, stubs, generated, and type-only files.
- [ ] 5.2 Measure the backbone's actual coverage and set the floor at or just under the baseline (floor-not-target, per design D-D).

## 6. Architectural boundaries (dependency-cruiser)

- [ ] 6.1 Create `.dependency-cruiser.cjs` with rules: `src/lib` must not depend on `src/app`; `no-circular`; nothing reachable from a `'use client'` module may transitively import `server-only`; `src/lib/runtime/**` reachable only from `src/instrumentation.ts`.
- [ ] 6.2 Structure the ruleset so future port/adapter rules slot in (a commented extension point for SignalSource / EnrichmentProvider / LLMProvider).

## 7. The verify gate

- [ ] 7.1 Wire `verify` = `tsc --noEmit` -> `eslint .` -> `format:check` -> `depcruise` -> `dup` -> `vitest run --coverage` -> `next build` (fail-fast order); `verify:fast` = tsc + eslint + vitest.
- [ ] 7.2 Run `verify` against the existing backbone and fix any findings in existing code until green (no feature code added).

## 8. Continuous integration

- [ ] 8.1 Add `.github/workflows/ci.yml`: trigger on push + PR, Node 22, a `postgres` service container, env wiring (`TEST_DATABASE_URL` / `APP_DATABASE_URL` / `PGBOSS_DATABASE_URL`), `npm ci`, run `verify`.
- [ ] 8.2 Confirm in CI logs that the DB and pg-boss tests RUN (not skip) against the service, and that the run is green.

## 9. Pre-commit (optional, fast subset)

- [ ] 9.1 If kept: configure husky + lint-staged to run `eslint --fix` + `prettier --write` on staged files only (not full verify).

## 10. Generation-time guidance (shift-left, per design D-J)

- [ ] 10.1 Add a tight "Engineering principles + definition of done" block to CLAUDE.md: reuse-before-build (find and follow the existing pattern; no parallel mechanism for config/data/jobs/LLM - use the env module, `db` module, jobs facade, `LLMProvider` port), DRY/SOLID + rule of three, run `verify` and self-review before declaring done. Keep it crisp (loaded every turn). Include a pointer to roadmap.md's verification posture.
- [ ] 10.2 Add a reuse-before-build / name-your-seam constraint to `openspec/config.yaml` design rules, so every generated `design.md` states which existing modules/seams it reuses rather than inventing a parallel one.

## 11. Documentation and acceptance

- [ ] 11.1 Add `docs/engineering.md`: testing strategy (unit vs integration-with-real-Postgres, what carries a coverage floor); the boundary-ruleset rationale; the **DRY/SOLID review checklist** including the **rule of three** (tolerate the second occurrence, extract at the third), the knowledge-duplication check (a single authoritative representation for each business rule/constant), and the reuse/pattern-consistency check; and the enforcement **cadence** (per-change `/opsx:verify` + the review pass run with architecture context; a whole-system review at each milestone boundary).
- [ ] 11.2 Acceptance: introduce (a) a deliberate lint error, (b) a deliberate boundary violation, and (c) a new uncovered module, confirm each fails `verify`, then revert all three.
