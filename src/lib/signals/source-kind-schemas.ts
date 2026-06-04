import "server-only";
import { z } from "zod";

// Per-kind connector config schemas, shared between the source-kind catalog (which the wizard
// renders + validates against, source-connection) and the connector (which parses source.config
// at scan time). A leaf module - it imports neither the registry nor any connector - so both the
// port-side catalog and the adapter-side connector can depend on it without crossing the
// port/adapter boundary (D-M) or forming a cycle. One home per kind keeps the two uses from drifting.

export const linkedinJobsConfigSchema = z.object({
  name: z.string().trim().default(""),
  keywords: z.string().trim().min(1),
  location: z.string().trim().default(""),
  postedWithin: z.string().trim().default(""),
});
export type LinkedinJobsConfig = z.infer<typeof linkedinJobsConfigSchema>;
