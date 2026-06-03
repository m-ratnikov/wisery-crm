import "server-only";
import { z } from "zod";
import { getActiveRubric } from "@/lib/icp/config";
import { getLLM } from "@/lib/llm";
import type { LLMProvider } from "@/lib/llm/provider";
import type { SignalRow } from "@/lib/signals/connector";
import { icpScorePromptV1 } from "@/prompts/icp_score_v1";

// The ported 1-5 ICP scorer (D5), reading the active rubric as config-as-data (D6) and
// calling through the LLMProvider port (D9, ADR-0003). The network call is injectable so
// tests use the fake provider (no key/network).

export const scoreResultSchema = z.object({
  // -1 (insufficient data) or 1-5; 0 is not a valid ICP score.
  score: z
    .number()
    .int()
    .min(-1)
    .max(5)
    .refine((s) => s !== 0, { message: "score must be -1 or 1-5, not 0" }),
  reason: z.string(),
  summary: z.string(),
});
export type ScoreResult = z.infer<typeof scoreResultSchema>;

export interface ScoredProspect {
  result: ScoreResult;
  rubricId: string;
  provider: string;
  promptVersion: string;
  model: string;
}

// Cheap model for the cost gate (D5); the expensive enrich/draft run only for the >= 3s.
const SCORE_MODEL = "claude-haiku-4-5-20251001";
const SCORE_MAX_TOKENS = 512;

export async function scoreProspect(
  signal: SignalRow,
  opts: { llm?: LLMProvider } = {},
): Promise<ScoredProspect> {
  const active = await getActiveRubric();
  if (!active) {
    throw new Error("no active ICP rubric; seed or configure one before qualifying");
  }
  const llm = opts.llm ?? getLLM();

  const userMessage = [
    "Score this prospect against the ICP rubric criteria below.",
    "",
    "## Rubric criteria",
    JSON.stringify(active.criteria, null, 2),
    "",
    "## Signal",
    `kind: ${signal.kind}`,
    JSON.stringify(signal.payload, null, 2),
  ].join("\n");

  const out = await llm.complete({
    prompt: icpScorePromptV1,
    messages: [{ role: "user", content: userMessage }],
    schema: scoreResultSchema,
    model: SCORE_MODEL,
    maxTokens: SCORE_MAX_TOKENS,
  });

  return {
    result: out.data,
    rubricId: active.id,
    provider: out.provider,
    promptVersion: out.promptVersion,
    model: out.model,
  };
}
