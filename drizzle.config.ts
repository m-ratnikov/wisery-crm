import "dotenv/config";
import { defineConfig } from "drizzle-kit";

// drizzle-kit runs outside Next, so it loads .env itself (dotenv above) and
// reads the URL directly - this is build tooling, not app runtime code.
const url = process.env.APP_DATABASE_URL;
if (!url) {
  throw new Error("APP_DATABASE_URL is required for drizzle-kit (set it in .env)");
}

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url },
});
