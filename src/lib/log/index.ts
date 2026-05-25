import "server-only";
import pino from "pino";

// The logger must exist before config validation runs (it reports config
// failures), so it reads its level straight from the environment with a safe
// default rather than depending on the validated config.
const level = process.env.LOG_LEVEL ?? "info";
const isDev = (process.env.NODE_ENV ?? "development") === "development";

export const logger = pino({
  level,
  redact: {
    paths: [
      "password",
      "*.password",
      "apiKey",
      "*.apiKey",
      "token",
      "*.token",
      "connectionString",
      "*.connectionString",
      "*.authorization",
    ],
    censor: "[redacted]",
  },
  ...(isDev
    ? {
        transport: {
          target: "pino-pretty",
          options: { colorize: true, translateTime: "SYS:standard" },
        },
      }
    : {}),
});
