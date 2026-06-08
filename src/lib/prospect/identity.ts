import "server-only";
import type { InferSelectModel } from "drizzle-orm";
import type { person } from "@/lib/db/schema";
import type { SignalRow } from "@/lib/signals/connector";

// The PersonSubject seam (ADR-0010): the {kind, payload} a prospect presents to scoring,
// drafting, and enrichment, resolved from its signal (discovered) or its own columns
// (manual). Shaped as {kind, payload} so a `SignalRow` satisfies it structurally - the
// discovered path passes its signal unchanged, no prompt drift - while a manual prospect
// synthesizes it. This is the ONE place origin is branched for the pipeline's read of a
// person; consumers take a PersonSubject and never look at origin.

type ProspectRow = InferSelectModel<typeof person>;

export interface PersonSubject {
  kind: string;
  payload: unknown;
}

export function personSubject(prospect: ProspectRow, signal: SignalRow | null): PersonSubject {
  if (prospect.origin === "manual") {
    return {
      kind: "person",
      payload: {
        name: prospect.name,
        headline: prospect.headline,
        company: prospect.company,
        linkedinUrl: prospect.linkedinUrl,
      },
    };
  }
  // Signal origin: the CHECK guarantees signal_id is present, so its row must load.
  if (!signal) {
    throw new Error(`signal-origin prospect ${prospect.id} is missing its signal`);
  }
  return { kind: signal.kind, payload: signal.payload };
}
