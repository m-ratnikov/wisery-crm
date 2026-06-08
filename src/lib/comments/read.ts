import "server-only";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { comments } from "@/lib/db/schema";

// Comment status vocabulary (engagement-comments, ADR-0018): generated -> posted (the human posts
// it by hand and marks it, D2) | dismissed. text+Zod (the churn-prone-set policy).
export const commentStatusSchema = z.enum(["generated", "posted", "dismissed"]);
export type CommentStatus = z.infer<typeof commentStatusSchema>;

export interface CommentRow {
  id: string;
  postId: string;
  body: string;
  status: string;
  createdAt: Date;
}

export async function listCommentsForPost(postId: string): Promise<CommentRow[]> {
  return getDb()
    .select({
      id: comments.id,
      postId: comments.postId,
      body: comments.body,
      status: comments.status,
      createdAt: comments.createdAt,
    })
    .from(comments)
    .where(eq(comments.postId, postId))
    .orderBy(desc(comments.createdAt));
}

// The comment lifecycle transitions (the human posts manually, then marks it, D2 - or discards it).
// Regenerate is not here: it is a fresh generateComment call writing a new row.
async function setStatus(commentId: string, status: CommentStatus): Promise<void> {
  await getDb().update(comments).set({ status }).where(eq(comments.id, commentId));
}

export async function markCommentPosted(commentId: string): Promise<void> {
  await setStatus(commentId, "posted");
}

export async function dismissComment(commentId: string): Promise<void> {
  await setStatus(commentId, "dismissed");
}
