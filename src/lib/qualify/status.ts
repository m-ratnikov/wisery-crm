import "server-only";
import { z } from "zod";

// Qualification (ADR-0019/0020): a derived READ over the latest icp Scoring, not a stored status.
// `qualified` (score >= 3) | `below_bar` (< 3, incl the -1 insufficient-data sentinel) | `unassessed`
// (no icp Scoring yet). The pipeline position (Person.status_id) is now a separate, orthogonal axis
// (ADR-0020), so the old `prospectStatusSchema` text enum is retired.
export type Qualification = "qualified" | "below_bar" | "unassessed";

// Person type (ADR-0015): a `prospect` is a potential buyer under ICP evaluation; a `peer` is an
// amplifier monitored for engagement. text + Zod - the column has no DB enum.
export const personTypeSchema = z.enum(["prospect", "peer"]);
export type PersonType = z.infer<typeof personTypeSchema>;

// The score gate (D5): >= 3 qualifies; below 3 or -1 (insufficient data) is below-bar, retained but
// not surfaced (the learning loop uses it later). The single authority on the >= 3 boundary, reused
// by the qualification read.
export function gateStatus(score: number): Exclude<Qualification, "unassessed"> {
  return score >= 3 ? "qualified" : "below_bar";
}
