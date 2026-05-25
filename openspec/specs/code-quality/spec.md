## Purpose

The repository's enforceable quality contract: a single `verify` gate every change must pass, plus the documented review and conformance cadence around it.

## Requirements

### Requirement: Single verification gate
The repository SHALL provide one command, `npm run verify`, that runs every automated quality gate and exits non-zero if any gate fails. This command is the definition of done for any change.

#### Scenario: All gates pass
- **WHEN** `npm run verify` runs against a change where types, spec/artifact structure, lint, formatting, coverage, boundaries, and build all pass
- **THEN** it exits zero

#### Scenario: Malformed spec or change artifact
- **WHEN** a canonical spec or change artifact is missing a required section or scenario
- **THEN** verify fails at the openspec validation step

#### Scenario: A gate fails
- **WHEN** any single gate fails during `npm run verify`
- **THEN** the command exits non-zero
- **AND** the output identifies which gate failed

#### Scenario: The existing backbone passes
- **WHEN** `npm run verify` runs against the current codebase with no feature code added
- **THEN** it exits zero

### Requirement: Static analysis gate
The verify gate SHALL fail on TypeScript type errors and on ESLint violations, including type-aware violations such as floating promises.

#### Scenario: Type error
- **WHEN** a module has a type error
- **THEN** verify fails at the type-check step

#### Scenario: Lint violation
- **WHEN** a module contains an unhandled (floating) promise or another error-level lint violation
- **THEN** verify fails at the lint step

### Requirement: Duplication and complexity gate
The verify gate SHALL fail on cross-file textual duplication above a configured threshold and on functions exceeding a cognitive-complexity ceiling. The duplication threshold SHALL be tuned to surface genuine copy-paste, not to force extraction of incidental similarity; the decision of when to extract a shared abstraction is governed by the rule of three (a review concern), not by the gate.

#### Scenario: Copy-pasted block
- **WHEN** a duplicated code block exceeds the configured duplication threshold
- **THEN** verify fails the duplication gate

#### Scenario: Excessively complex function
- **WHEN** a function's cognitive complexity (nesting-aware) exceeds the configured ceiling
- **THEN** verify fails the complexity check

#### Scenario: Incidental similarity is tolerated
- **WHEN** two small fragments are similar but below the configured threshold
- **THEN** the duplication gate does not fail, leaving the extract-or-not decision to review under the rule of three

### Requirement: Consistent formatting
The verify gate SHALL fail when source files do not match the project's single formatting standard.

#### Scenario: Unformatted file
- **WHEN** a committed source file does not match the formatter's output
- **THEN** verify fails the formatting check

### Requirement: Test coverage floor
The verify gate SHALL run the test suite and SHALL fail when coverage falls below the configured floor. The floor SHALL be enforced per file, so a new uncovered module cannot be masked by high coverage elsewhere.

#### Scenario: Coverage below floor
- **WHEN** the test run reports coverage below the configured threshold
- **THEN** verify fails

#### Scenario: New module without tests
- **WHEN** a new source module is added with coverage below the per-file floor
- **THEN** verify fails even if overall project coverage remains above the floor

#### Scenario: Tests and coverage satisfied
- **WHEN** all tests pass and coverage meets or exceeds the floor
- **THEN** the coverage gate passes

### Requirement: Architectural boundaries are enforced
The verify gate SHALL fail when code violates a declared architectural boundary, so that seams are protected by the build rather than by convention. The boundary ruleset is extensible as new seams (ports and adapters) are introduced.

#### Scenario: Lower layer imports a higher layer
- **WHEN** a module under `src/lib` imports a module under `src/app`
- **THEN** verify fails the boundary check

#### Scenario: Circular dependency
- **WHEN** two or more modules form an import cycle
- **THEN** verify fails the boundary check

#### Scenario: Server-only code reachable from the client
- **WHEN** a `server-only` module becomes reachable from a client (`'use client'`) module
- **THEN** verify fails the boundary check

### Requirement: Continuous integration enforces the gate
CI SHALL run the verify gate on every push and pull request, and the database and job tests SHALL execute in CI (not skip) by running against a provisioned Postgres instance.

#### Scenario: Failing change on a pull request
- **WHEN** a pull request contains code that fails verify
- **THEN** the CI check reports failure on that pull request

#### Scenario: Database tests run in CI
- **WHEN** CI runs the test suite
- **THEN** the Postgres and pg-boss integration tests execute against the CI Postgres service rather than skipping for a missing database URL

### Requirement: Each change receives a review pass with system context
Every change SHALL receive a code-review pass before it is archived, covering correctness and design concerns that automated gates cannot judge. The pass SHALL be run with the relevant architecture documents in context (not the diff alone, which is inherently local) and SHALL use a written checklist that includes knowledge-duplication (the same rule expressed in two places), reuse and pattern-consistency (does this re-implement something that exists, or introduce a parallel mechanism instead of the established one), single-responsibility and naming, and the rule of three (do not extract a shared abstraction until the third occurrence; tolerate the second).

#### Scenario: Review before archive
- **WHEN** a change's implementation is complete and verify is green
- **THEN** a code-review pass is run against the checklist with architecture context and its findings are triaged before the change is archived

#### Scenario: Locally fine but inconsistent with the system
- **WHEN** new code passes all mechanical gates but introduces a parallel way of doing work the system already has an established pattern for
- **THEN** the review flags it as a reuse/consistency finding

#### Scenario: Rule of three guides extraction
- **WHEN** the review finds a piece of logic duplicated for the third time
- **THEN** extraction of a shared abstraction is warranted
- **AND** a mere second occurrence is left in place rather than abstracted prematurely

### Requirement: Conformance and whole-system review
Each change SHALL be verified for conformance to its design and the accepted ADRs before archive. In addition, at milestone boundaries a whole-system review SHALL be run over the accumulated code to catch architectural drift that no single change's review reveals.

#### Scenario: Per-change conformance
- **WHEN** a change is complete
- **THEN** its implementation is checked against its design and the accepted ADRs before it is archived

#### Scenario: Milestone whole-system pass
- **WHEN** a roadmap milestone (for example M1) completes
- **THEN** a whole-system architecture review is run over the accumulated code, separate from the per-change reviews
