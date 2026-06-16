import "server-only";
import { getDb } from "@/lib/db";
import { signalAdvisory } from "@/lib/db/schema";
import { getActiveRubric } from "@/lib/icp/config";
import { type RubricKind, rubricKindSchema } from "@/lib/icp/schema";
import type { LLMProvider } from "@/lib/llm/provider";
import { scoreSubject } from "@/lib/triage/scorer";
import { loadSignalById } from "@/lib/signals/load";

// The advisory filter (universal-triage, ADR-0013/0017): score a pending signal against the rubric
// matching its intent and store a lightweight hint for the triage lane. This is the only score in
// the system (ADR-0022) - it stays on the signal, never copied to a created entity. The LLM is
// injectable so tests run on the fake.

// Which rubric kind scores which signal kind. A non-modeled kind (job, future) falls back to the
// buyer rubric pragmatically until its own rubric kind is configured.
export function rubricKindForSignal(signalKind: string): RubricKind {
  switch (signalKind) {
    case "person":
      return rubricKindSchema.enum.icp;
    case "content":
      return rubricKindSchema.enum.peer;
    case "company":
      return rubricKindSchema.enum.company;
    default:
      return rubricKindSchema.enum.icp;
  }
}

export interface AdvisoryOutcome {
  signalId: string;
  rubricKind: RubricKind;
  scored: boolean;
}

export async function runAdvisoryFilter(
  signalId: string,
  opts: { llm?: LLMProvider } = {},
): Promise<AdvisoryOutcome> {
  const db = getDb();
  const signal = await loadSignalById(signalId);

  const rubricKind = rubricKindForSignal(signal.kind);
  const active = await getActiveRubric(rubricKind);

  let score: number | null = null;
  let reason: string | null = null;
  if (active) {
    // A signal row satisfies PersonSubject structurally ({kind, payload}); score it against the
    // intent-matched rubric. OUTSIDE any transaction (the LLM call must not sit in one).
    const scored = await scoreSubject({ kind: signal.kind, payload: signal.payload }, active, {
      llm: opts.llm,
    });
    score = scored.score;
    reason = scored.reason;
  } else {
    reason = `no active ${rubricKind} rubric; advisory unavailable for this intent`;
  }

  await db
    .insert(signalAdvisory)
    .values({ signalId, rubricKind, score, reason })
    .onConflictDoUpdate({
      target: signalAdvisory.signalId,
      set: { rubricKind, score, reason, createdAt: new Date() },
    });

  return { signalId, rubricKind, scored: active != null };
}
