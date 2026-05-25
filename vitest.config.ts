import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const srcDir = fileURLToPath(new URL("./src", import.meta.url));
// `server-only`/`client-only` throw outside a React Server context, so server
// modules (config, db, jobs, log) cannot be imported under Vitest without a stub.
const emptyStub = fileURLToPath(new URL("./tests/stubs/empty.ts", import.meta.url));

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    setupFiles: ["dotenv/config"],
    alias: {
      "@": srcDir,
      "server-only": emptyStub,
      "client-only": emptyStub,
    },
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "text"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.test.ts",
        "src/lib/db/schema.ts", // empty placeholder until the first entity lands
        "**/*.d.ts",
        // Pre-harness runtime/bootstrap glue + Next scaffolding: exercised by the
        // live boot smoke and integration, not unit tests (see docs/engineering.md).
        "src/instrumentation.ts",
        "src/lib/runtime/**",
        "src/app/**",
        "src/lib/log/**",
        // Thin pg-boss facade (delegation to pg-boss); it gains real coverage when
        // the first capability enqueues through it with isolated-schema integration
        // tests. Excluded until then rather than asserting a performative or
        // dev-schema-touching test.
        "src/lib/jobs/**",
      ],
      thresholds: {
        // Per-file so a new untested module cannot hide behind global coverage.
        perFile: true,
        // Floor set just under the measured backbone baseline; ratchet up as the
        // suite grows (floor-not-target, design D-D).
        lines: 75,
        statements: 70,
        functions: 70,
        branches: 25,
      },
    },
  },
});
