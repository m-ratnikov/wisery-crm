import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const srcDir = fileURLToPath(new URL("./src", import.meta.url));
// `server-only`/`client-only` throw outside a React Server context, so server
// modules (config, db, jobs, log) cannot be imported under Vitest without a stub.
const emptyStub = fileURLToPath(new URL("./tests/stubs/empty.ts", import.meta.url));

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    // dotenv/config loads .env first; setup-db then remaps the test process onto TEST_DATABASE_URL
    // and refuses to run against a non-test database, so integration suites never truncate the dev DB.
    setupFiles: ["dotenv/config", "./tests/setup-db.ts"],
    // Integration suites run against the dedicated test database (TEST_DATABASE_URL, remapped by
    // setup-db above - never the dev DB) and each truncates the tables it owns. Run test files
    // sequentially so one suite's inserts never race another's FK-ordered truncation. The suite is
    // small; correctness first.
    fileParallelism: false,
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
        "**/*.d.ts",
        // Declarative Drizzle table/enum definitions (DDL as data), not logic. Validated
        // by db:generate (migration SQL review), db:migrate, and the integration tests;
        // its drizzle-internal callbacks (.$onUpdate, index builders) are not meaningfully
        // unit-coverable, so per-file line coverage here would only invite performative tests.
        "src/lib/db/schema.ts",
        // Pre-harness runtime/bootstrap glue + Next scaffolding: exercised by the
        // live boot smoke and integration, not unit tests (see docs/engineering.md).
        "src/instrumentation.ts",
        "src/lib/runtime/**",
        "src/app/**",
        "src/lib/log/**",
        // Thin pg-boss wrappers (delegation to pg-boss). Revisited at signal-ingestion
        // (its tasks 8.1): the jobs facade stays pure delegation, and scan-queue is a
        // queue/worker wrapper over it whose only logic is calling the fully-tested
        // runScan core. Both are exercised by the live boot, not by dev-schema-touching
        // or performative tests; the scan pipeline itself is covered by integration.
        // index.ts stays excluded as I/O delegation; its pure raw->DTO mapping half
        // (activity-map.ts) is coverage-included and unit-tested - same split as the LinkedIn
        // connector (normalizeJob included, the network client excluded). activity-view.ts is
        // types-only (no executable lines).
        "src/lib/jobs/index.ts",
        "src/lib/signals/scan-queue.ts",
        "src/lib/qualify/qualify-queue.ts",
        "src/lib/draft/draft-queue.ts",
        "src/lib/enrich/enrich-queue.ts",
        // Network adapters needing an API key/token; exercised by a live smoke, not unit
        // tests (same precedent as the pg-boss wrappers). Each port's contract, fake, and
        // pipeline are unit/integration-covered.
        "src/lib/llm/anthropic.ts",
        "src/lib/enrich/apify.ts",
        // The LinkedIn jobs network fetch + connector scan (needs real endpoint access,
        // exercised by a live smoke). Its pure mapping (normalizeJob) + config schema live in
        // linkedin-jobs.ts and stay coverage-included and unit-tested (linkedin-jobs-source).
        "src/lib/signals/connectors/linkedin-jobs-client.ts",
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
