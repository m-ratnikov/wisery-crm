import "server-only";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getActiveGuidance } from "@/lib/comments/guidance";
import { getDb } from "@/lib/db";
import { comments, person, posts, signals } from "@/lib/db/schema";
import { getLLM } from "@/lib/llm";
import type { LLMProvider } from "@/lib/llm/provider";
import { personSubject } from "@/lib/prospect/identity";
import { commentPromptV1 } from "@/prompts/comment_v1";

// The comment generation core (engagement-comments, ADR-0018). SYNCHRONOUS (invoked by a Feed
// server action, NOT a pg-boss handler): each call writes a NEW Comment row, so there is no
// idempotency key and no background retry that could double-bill - a transient LLM error surfaces
// to the user, who clicks again. The LLM is injectable so tests run on the fake. db-only.
export const commentResultSchema = z.object({ body: z.string().min(1) });

const COMMENT_MODEL = "claude-opus-4-8";
const COMMENT_MAX_TOKENS = 512;

export interface GeneratedComment {
  id: string;
  body: string;
}

export async function generateComment(
  postId: string,
  opts: { llm?: LLMProvider } = {},
): Promise<GeneratedComment> {
  const db = getDb();
  const [post] = await db.select().from(posts).where(eq(posts.id, postId)).limit(1);
  if (!post) throw new Error(`post ${postId} not found`);
  const [p] = await db.select().from(person).where(eq(person.id, post.personId)).limit(1);
  if (!p) throw new Error(`person ${post.personId} not found`);
  // Resolve the person's identity through the PersonSubject seam (ADR-0010), not the raw person
  // columns: a signal-origin peer (the common engagement case) carries name/headline in its
  // signal payload, with the person columns null. Reading the columns directly produced a
  // context-blind comment for exactly that case.
  const [signal] = p.signalId
    ? await db.select().from(signals).where(eq(signals.id, p.signalId)).limit(1)
    : [null];
  const subject = personSubject(p, signal ?? null);
  const guidance = await getActiveGuidance();
  const llm = opts.llm ?? getLLM();

  const userMessage = [
    "Write a comment to leave on this person's post, following the guidance.",
    "",
    "## Comment guidance",
    JSON.stringify(
      guidance?.guidance ?? { tone: "warm, genuine, peer-to-peer", rules: [] },
      null,
      2,
    ),
    "",
    "## Person",
    `kind: ${subject.kind}`,
    JSON.stringify(subject.payload, null, 2),
    "",
    "## Post",
    post.content,
  ].join("\n");

  const out = await llm.complete({
    prompt: commentPromptV1,
    messages: [{ role: "user", content: userMessage }],
    schema: commentResultSchema,
    model: COMMENT_MODEL,
    maxTokens: COMMENT_MAX_TOKENS,
  });

  const [row] = await db
    .insert(comments)
    .values({
      postId,
      personId: post.personId,
      body: out.data.body,
      status: "generated",
      provider: out.provider,
      promptVersion: out.promptVersion,
      model: out.model,
    })
    .returning({ id: comments.id });

  return { id: row.id, body: out.data.body };
}
