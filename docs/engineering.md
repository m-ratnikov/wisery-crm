# Engineering - quality harness

How code quality is enforced in this repo. Stood up by the `quality-harness` change;
the sequencing context is in [roadmap.md](roadmap.md) (verification posture).

## The verify gate

`npm run verify` is the definition of done for every change. It runs, fail-fast:

1. `tsc --noEmit` - types (whole program)
2. `eslint .` - lint, including type-aware rules and `sonarjs/cognitive-complexity` (nesting-aware; replaces core cyclomatic `complexity`)
3. `prettier --check .` - formatting
4. `depcruise src` - architectural boundaries
5. `jscpd src` - duplication
6. `vitest run --coverage` - tests + per-file coverage floor
7. `next build` - the app builds

`npm run verify:fast` (tsc + eslint + tests) is the quick inner-loop subset; the full
gate runs before push and in CI.

These gates run **whole-tree**, not over the diff, so they catch system-context
regressions: a new import that breaks a boundary with existing modules, cross-file
duplication, a type break in a consumer, a broken existing test.

`verify` requires a reachable test Postgres (the DB and pg-boss tests connect for real -
see below). CI provides one; locally, point `TEST_DATABASE_URL` / `APP_DATABASE_URL` /
`PGBOSS_DATABASE_URL` at your instance (`localhost:5433` in dev).

## Testing strategy

- **Unit tests** for pure logic (config parsing, future domain rules) - no I/O, always run.
- **Integration tests** for anything touching Postgres or pg-boss - they connect to a real
  database (no mocks; mocking these defeats their purpose). They gate on `TEST_DATABASE_URL`
  and skip cleanly when it is unset, so a contributor without a DB can still run the suite -
  but **CI sets the URL so they always run there** (a skipped integration test is not a passing one).
- pg-boss tests use an isolated schema (`pgboss_test`) so they never touch the dev `pgboss` schema.

### Coverage floor

Per-file thresholds (`vitest.config.ts`), so a new untested module cannot hide behind high
overall coverage. The floor is set just under the measured baseline and ratcheted up as the
suite grows - a floor, not a target. Setting it above reality is performative; it gets disabled
the first time it blocks.

Excluded from the floor (with reason, not to game the number):

- `src/app/**` - Next pages, layouts, route handlers: component/integration territory, not unit tests.
- `src/instrumentation.ts`, `src/lib/runtime/**` - process bootstrap glue, exercised by the live boot smoke and integration.
- `src/lib/log/**` - logger construction (pino config), no branching logic worth a unit test.
- `src/lib/jobs/**` - the thin pg-boss facade is delegation only; it earns real coverage when the first capability enqueues through it with isolated-schema integration tests. Excluded until then rather than asserting a performative or dev-schema-touching test. **Revisit when `signal-ingestion` lands.**

## Architectural boundaries (dependency-cruiser)

`.dependency-cruiser.cjs` encodes seams as build-failing rules:

- `no-circular` - no import cycles.
- `lib-not-to-app` - `src/lib` (lower layer) must not depend on `src/app`.
- `runtime-bootstrap-isolation` - `src/lib/runtime` is reached only via `src/instrumentation.ts`'s dynamic import (ADR-0001), so nothing Node-specific is statically reachable from the Edge compile.

The **server-only / client** boundary is enforced by `next build` (the `server-only` package
throws when pulled into a client bundle), so it is not duplicated here. The ruleset has a
documented extension point: as the D4/D9 ports land, add "adapters depend on ports, never the
reverse" rules - the one SOLID principle (dependency inversion) that is mechanically enforceable.

## Duplication (jscpd)

`.jscpd.json`: `minTokens: 50`, `threshold: 0` over `src`. A block of 50+ duplicated tokens fails
the gate; smaller incidental similarity does not (that headroom is deliberate). The gate's job is
to make genuine copy-paste **visible** - it does not mandate extraction. When it fires, apply the
rule of three: a third occurrence warrants a shared abstraction; a second is left in place.

## What tools cannot judge - the review pass

Mechanical gates enforce the *textual* half of DRY and *dependency direction*. The *knowledge*
half of DRY and the rest of SOLID are judgment, caught by a `code-review` pass run **with the
architecture docs in context** (not the diff alone, which is inherently local). Checklist:

- **Knowledge-DRY:** is any business rule or constant (e.g. the ICP score bar) defined in more than one place? One authoritative representation.
- **Reuse / consistency:** does this re-implement something that exists, or introduce a parallel mechanism instead of the established one (config / db / jobs / LLM)?
- **Rule of three:** is a shared abstraction being introduced at only the second occurrence? Prefer to wait for the third.
- **SOLID (judgment parts):** does each module have one reason to change (SRP)? Naming, and the right seam.

## Enforcement cadence

- **Per change:** `verify` green + a `code-review` pass with architecture context + `/opsx:verify` (conformance to the change's design and the accepted ADRs) before archive.
- **At archive:** archive with the CLI - `openspec archive <name> --yes` - which merges the change's delta specs into `openspec/specs/` and **validates them by default**. This is where canonical-spec structure is enforced; `verify`/CI stay purely code (do not run `openspec validate` in CI - spec validation belongs at the spec lifecycle boundary, not the code build). The `/opsx:archive` skill is patched to use this CLI (Fission-AI/OpenSpec #863, #913).
- **Per milestone (M1, M2, ...):** a whole-system review over the accumulated code (point the architecture panel at it) to catch drift no single change reveals. The per-change reviews are structurally local; this is the global pass.

## Generation-time guidance (shift-left)

Quality is biased up front, not only gated after: `CLAUDE.md` carries the engineering principles
(reuse-before-build, rule of three, definition of done) loaded into every coding session, and
`openspec/config.yaml` carries a reuse-before-build design rule so every `design.md` is generated
reuse-aware. This is soft guidance - it shapes output; the gates remain the enforcement.
