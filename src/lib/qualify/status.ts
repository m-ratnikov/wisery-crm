import "server-only";
import { z } from "zod";

// The full Person disposition vocabulary (ADR-0008: status is disposition-only;
// `enriched`/`drafted` are NOT statuses - derived from the DOSSIER/DRAFT relations;
// `scored` dropped - scoring gates straight to qualified/below_bar). The enum is the
// decided vocabulary even though each capability writes only a subset (qualification:
// qualified/below_bar; drafting: queued; review-queue: acted/dismissed/closed).
export const prospectStatusSchema = z.enum([
  "new",
  "below_bar",
  "qualified",
  "queued",
  "acted",
  "dismissed",
  "closed",
]);

export type ProspectStatus = z.infer<typeof prospectStatusSchema>;

// Person type (ADR-0015): a `prospect` is a potential buyer under ICP evaluation; a `peer` is an
// amplifier monitored for engagement. text + Zod - the column has no DB enum.
export const personTypeSchema = z.enum(["prospect", "peer"]);
export type PersonType = z.infer<typeof personTypeSchema>;

// The score gate (D5): >= 3 qualifies; below 3 or -1 (insufficient data) is below-bar,
// retained but not surfaced (the learning loop uses it later).
export function gateStatus(score: number): ProspectStatus {
  return score >= 3 ? "qualified" : "below_bar";
}
