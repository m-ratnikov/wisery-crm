// Mutation testing - the regression sensor that sharpens our coverage floor.
//
// Why this exists: a per-file coverage floor (vitest.config.ts) answers "was this
// line executed", not "would a test fail if the behaviour changed". When tests are
// largely agent-written, that gap matters - high coverage can hide assertion-light
// tests. Stryker mutates the source and checks the suite catches each change, which
// is the question a regression sensor should actually answer.
//
// Scope + cadence (deliberate):
//   - Mutates ONLY pure-logic units (no I/O), the same surface the coverage floor
//     guards. App/UI, runtime bootstrap, the pg-boss facade and the logger are out
//     of scope - they are exercised by integration/boot smoke, not unit assertions.
//   - Runs OUT-OF-BAND (npm run test:mutation), never inside `verify`/`verify:fast`.
//     Mutation testing is O(mutants x suite); putting it in the per-change gate would
//     wreck the inner loop. It is an on-demand / per-milestone sensor.
//
// Read survivors with: npm run mutation:survivors (agent-queryable summary).
/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
const config = {
  testRunner: "vitest",
  // Pure-logic surface only (no I/O), each with PURE unit coverage so a mutant reruns a
  // fast non-DB test, never the DB integration suite. Widen as new no-I/O domain modules
  // land - keep it in lockstep with the coverage-floor include, and add a pure unit test
  // first for any unit currently covered only by integration (e.g. qualify-status.test.ts
  // was added so gateStatus could enter this set without dragging in the qualify DB suite).
  mutate: [
    "src/lib/config/**/*.ts",
    "src/lib/llm/anthropic-errors.ts", // toLLMError classifier (llm-provider.test.ts, pure)
    "src/lib/qualify/status.ts", // gateStatus + disposition enum (qualify-status.test.ts, pure)
  ],
  reporters: ["clear-text", "progress", "json"],
  // Floor-not-target, same methodology as the coverage floor: set `break` just under
  // the measured baseline and ratchet up as the suite grows - never above reality.
  // Baseline 94.03% (2026-06-02, M1: mutate widened to anthropic-errors.ts + status.ts,
  // both 100%). The only survivors are equivalent mutants in env.ts (StringLiteral in the
  // aggregated error-message formatting, single-element path .join) not worth chasing.
  thresholds: { high: 95, low: 85, break: 90 },
  // JSON report feeds the survivor-summary script; keep the path stable.
  jsonReporter: { fileName: "reports/mutation/mutation.json" },
  // Quieter logs; the survivor script is the agent-facing surface.
  logLevel: "info",
};

export default config;
