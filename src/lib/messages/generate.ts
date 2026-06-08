import "server-only";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { messages, person, signals } from "@/lib/db/schema";
import { getUserProfile } from "@/lib/icp/config";
import { getLLM } from "@/lib/llm";
import type { LLMProvider } from "@/lib/llm/provider";
import { personSubject } from "@/lib/prospect/identity";
import { messagePromptV1 } from "@/prompts/message_v1";

// The LinkedIn message generation core (engagement-rework, ADR-0021). SYNCHRONOUS (invoked by a
// Person-workspace server action, NOT a pg-boss handler): each call writes a NEW Message row, so
// there is no idempotency key and no background retry that could double-bill - a transient LLM error
// surfaces to the user, who clicks again. The LLM is injectable so tests run on the fake. db-only.

// A message TYPE drives generation and is the person's history label (ADR-0021). text+Zod, like
// status (the churn-prone-set policy).
export const messageTypeSchema = z.enum(["connection_request", "message"]);
export type MessageType = z.infer<typeof messageTypeSchema>;

export const messageResultSchema = z.object({ body: z.string().min(1) });

const MESSAGE_MODEL = "claude-opus-4-8";
const MESSAGE_MAX_TOKENS = 512;

export interface GeneratedMessage {
  id: string;
  body: string;
}

export async function generateMessage(
  personId: string,
  type: string,
  opts: { llm?: LLMProvider } = {},
): Promise<GeneratedMessage> {
  const messageType = messageTypeSchema.parse(type);
  const db = getDb();
  const [p] = await db.select().from(person).where(eq(person.id, personId)).limit(1);
  if (!p) throw new Error(`person ${personId} not found`);
  // Resolve identity through the PersonSubject seam (ADR-0010), not the raw person columns: a
  // signal-origin person carries name/headline in its signal payload, with the person columns null.
  const [signal] = p.signalId
    ? await db.select().from(signals).where(eq(signals.id, p.signalId)).limit(1)
    : [null];
  const subject = personSubject(p, signal ?? null);
  const profile = await getUserProfile();
  const llm = opts.llm ?? getLLM();

  const userMessage = [
    "Write a LinkedIn message of the given type to this person, in the operator's voice.",
    "",
    "## Message type",
    messageType,
    "",
    "## Person",
    `kind: ${subject.kind}`,
    JSON.stringify(subject.payload, null, 2),
    "",
    "## Operator profile",
    profile
      ? JSON.stringify(profile.profile, null, 2)
      : "No operator profile set. Write in a warm, genuine, peer-to-peer voice.",
  ].join("\n");

  const out = await llm.complete({
    prompt: messagePromptV1,
    messages: [{ role: "user", content: userMessage }],
    schema: messageResultSchema,
    model: MESSAGE_MODEL,
    maxTokens: MESSAGE_MAX_TOKENS,
  });

  const [row] = await db
    .insert(messages)
    .values({
      personId,
      type: messageType,
      body: out.data.body,
      status: "generated",
      provider: out.provider,
      promptVersion: out.promptVersion,
      model: out.model,
    })
    .returning({ id: messages.id });

  return { id: row.id, body: out.data.body };
}
