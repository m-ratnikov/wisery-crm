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
  },
});
