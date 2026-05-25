import "server-only";
import { z } from "zod";

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_DATABASE_URL: z.string().min(1),
  PGBOSS_DATABASE_URL: z.string().min(1).optional(),
  APP_DB_POOL_MAX: z.coerce.number().int().positive().default(10),
  PGBOSS_DB_POOL_MAX: z.coerce.number().int().positive().default(5),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
});

export type Config = {
  nodeEnv: "development" | "test" | "production";
  isDev: boolean;
  appDatabaseUrl: string;
  pgbossDatabaseUrl: string;
  appDbPoolMax: number;
  pgbossDbPoolMax: number;
  logLevel: string;
  anthropicApiKey?: string;
};

// Pure, testable: throws a clear, aggregated error naming every bad var.
export function parseEnv(source: NodeJS.ProcessEnv = process.env): Config {
  const result = EnvSchema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join(".") || "(env)"}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  const e = result.data;
  return {
    nodeEnv: e.NODE_ENV,
    isDev: e.NODE_ENV === "development",
    appDatabaseUrl: e.APP_DATABASE_URL,
    pgbossDatabaseUrl: e.PGBOSS_DATABASE_URL ?? e.APP_DATABASE_URL,
    appDbPoolMax: e.APP_DB_POOL_MAX,
    pgbossDbPoolMax: e.PGBOSS_DB_POOL_MAX,
    logLevel: e.LOG_LEVEL,
    anthropicApiKey: e.ANTHROPIC_API_KEY,
  };
}

// Lazy + memoized so importing this module is side-effect-free; the first
// access (at boot) is where invalid config fails fast.
let cached: Config | undefined;
export function getConfig(): Config {
  if (!cached) cached = parseEnv();
  return cached;
}
