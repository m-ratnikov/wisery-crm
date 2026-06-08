import "server-only";
import { z } from "zod";

// The Person disposition vocabulary (ADR-0008: status is disposition-only; `enriched` is NOT a
// status - derived from the DOSSIER relation). ADR-0019 retired the drafting stage and the
// qualify-prospect worker, so `queued`/`acted`/`dismissed`/`closed` are now unsettable and dropped:
// a person is `new` until scored, then gated to `qualified`/`below_bar` by re-score.
export const prospectStatusSchema = z.enum(["new", "below_bar", "qualified"]);

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
