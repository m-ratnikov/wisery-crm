import { describe, expect, it } from "vitest";
import { parseEnv } from "@/lib/config/env";

// platform-runtime: "Configuration is validated at startup"
describe("config: env validation", () => {
  it("fails fast naming a missing required var", () => {
    expect(() => parseEnv({} as NodeJS.ProcessEnv)).toThrow(/APP_DATABASE_URL/);
  });

  it("parses valid env and applies defaults", () => {
    const c = parseEnv({ APP_DATABASE_URL: "postgres://x" } as unknown as NodeJS.ProcessEnv);
    expect(c.appDatabaseUrl).toBe("postgres://x");
    expect(c.pgbossDatabaseUrl).toBe("postgres://x"); // falls back to the app URL
    expect(c.appDbPoolMax).toBe(10);
    expect(c.logLevel).toBe("info");
  });

  it("derives isDev from NODE_ENV", () => {
    const base = { APP_DATABASE_URL: "postgres://x" };
    expect(parseEnv({ ...base, NODE_ENV: "development" }).isDev).toBe(true);
    expect(parseEnv({ ...base, NODE_ENV: "production" }).isDev).toBe(false);
  });

  it("aggregates every bad var into one newline-separated error", () => {
    const run = () => parseEnv({ APP_DB_POOL_MAX: "-1" } as unknown as NodeJS.ProcessEnv);
    // Both the missing required var and the invalid one are named...
    expect(run).toThrow(/APP_DATABASE_URL/);
    expect(run).toThrow(/APP_DB_POOL_MAX/);
    // ...on separate, prefixed lines (the aggregation contract).
    try {
      run();
    } catch (err) {
      expect((err as Error).message).toMatch(/\n {2}- /);
    }
  });
});
