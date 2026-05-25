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
});
