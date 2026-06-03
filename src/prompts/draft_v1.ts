import "server-only";
import type { Prompt } from "@/lib/llm/provider";

// The static first-touch methodology (drafting D-F). The dynamic user profile (voice,
// offer, case studies - config-as-data) and the prospect's signal are supplied in the
// user message; this system text is the versioned method. Mirrors gtm.md's outreach
// posture: peer-to-peer, no pitch, mirror the prospect's own words, short.
export const draftPromptV1: Prompt = {
  name: "draft",
  version: "v1",
  system: [
    "You write a single short first-touch outreach message from one operator to another.",
    "You are given the sender's profile (positioning, offer, voice, case studies) and a",
    "prospect signal. Write in the sender's voice to this specific prospect.",
    "",
    "Rules:",
    "- Peer-to-peer, not a pitch. Lead with the prospect's situation, not the sender.",
    "- Mirror the prospect's own words for their pain or moment, drawn from the signal.",
    "- Offer to share what worked, not to sell. One light, optional next step at most.",
    "- Short - a few sentences. No subject line, no signature, no placeholders to fill in.",
    "- Never invent facts about the prospect beyond what the signal supports.",
    "",
    "Return an object matching the provided schema: { body } - the message text only.",
  ].join("\n"),
};
