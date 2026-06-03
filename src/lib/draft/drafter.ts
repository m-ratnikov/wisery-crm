import "server-only";
import { z } from "zod";
import type { UserProfileData } from "@/lib/icp/schema";
import { getLLM } from "@/lib/llm";
import type { LLMProvider } from "@/lib/llm/provider";
import type { SignalRow } from "@/lib/signals/connector";
import { draftPromptV1 } from "@/prompts/draft_v1";

// Generates the first-touch message from the user profile + the signal through the
// LLMProvider port (D-B). The provider is injectable so tests use the fake (no key/network).

export const draftResultSchema = z.object({
  body: z.string().min(1),
});
export type DraftResult = z.infer<typeof draftResultSchema>;

export interface DraftedMessage {
  body: string;
  provider: string;
  promptVersion: string;
  model: string;
}

// The high-value generative step (stronger model than the cheap scorer).
const DRAFT_MODEL = "claude-opus-4-8";
const DRAFT_MAX_TOKENS = 1024;

export async function draftMessage(
  signal: SignalRow,
  profile: UserProfileData,
  opts: { llm?: LLMProvider; dossier?: unknown } = {},
): Promise<DraftedMessage> {
  const llm = opts.llm ?? getLLM();

  const lines = [
    "Write a short first-touch message to this prospect, in the sender's voice.",
    "",
    "## Sender profile",
    `Positioning: ${profile.positioning}`,
    `Offer: ${profile.offer}`,
    `Voice: ${profile.voice}`,
    `Case studies: ${profile.caseStudies.map((c) => `${c.title} - ${c.result}`).join("; ")}`,
    "",
    "## Prospect signal",
    `kind: ${signal.kind}`,
    JSON.stringify(signal.payload, null, 2),
  ];
  // When the prospect has been enriched, ground the draft in the richer dossier (ADR-0007).
  if (opts.dossier !== undefined && opts.dossier !== null) {
    lines.push("", "## Enrichment dossier (ground the message in this research)");
    lines.push(JSON.stringify(opts.dossier, null, 2));
  }
  const userMessage = lines.join("\n");

  const out = await llm.complete({
    prompt: draftPromptV1,
    messages: [{ role: "user", content: userMessage }],
    schema: draftResultSchema,
    model: DRAFT_MODEL,
    maxTokens: DRAFT_MAX_TOKENS,
  });

  return {
    body: out.data.body,
    provider: out.provider,
    promptVersion: out.promptVersion,
    model: out.model,
  };
}
