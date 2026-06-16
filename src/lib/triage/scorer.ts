import "server-only";
import { z } from "zod";
import { getLLM } from "@/lib/llm";
import type { LLMProvider } from "@/lib/llm/provider";
import type { PersonSubject } from "@/lib/prospect/identity";
import { icpScorePromptV1 } from "@/prompts/icp_score_v1";

// The 1-5 rubric scorer behind the advisory filter (D5 ported; ADR-0022: the signal advisory is
// the only score in the system). Reads the rubric criteria it is handed (config-as-data, D6) and
// calls through the LLMProvider port (D9, ADR-0003). The network call is injectable so tests use
// the fake provider (no key/network).

const scoreResultSchema = z.object({
  // -1 (insufficient data) or 1-5; 0 is not a valid score.
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

// Cheap model for the cost gate (D5): the advisory pass runs on every scanned signal.
const SCORE_MODEL = "claude-haiku-4-5-20251001";
const SCORE_MAX_TOKENS = 512;

export async function scoreSubject(
  subject: PersonSubject,
  rubric: { criteria: unknown },
  opts: { llm?: LLMProvider } = {},
): Promise<ScoreResult> {
  const llm = opts.llm ?? getLLM();

  // The v1 prompt and this message are ICP-framed even though peer/company rubrics also flow
  // through here (pre-existing from the ported scorer); a kind-aware framing means a new prompt
  // version, not an edit (prompt files are immutable per version).
  const userMessage = [
    "Score this prospect against the ICP rubric criteria below.",
    "",
    "## Rubric criteria",
    JSON.stringify(rubric.criteria, null, 2),
    "",
    "## Signal",
    `kind: ${subject.kind}`,
    JSON.stringify(subject.payload, null, 2),
  ].join("\n");

  const out = await llm.complete({
    prompt: icpScorePromptV1,
    messages: [{ role: "user", content: userMessage }],
    schema: scoreResultSchema,
    model: SCORE_MODEL,
    maxTokens: SCORE_MAX_TOKENS,
  });

  return out.data;
}
