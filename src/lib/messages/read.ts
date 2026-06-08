import "server-only";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { messages } from "@/lib/db/schema";

// Message status vocabulary (engagement-rework, ADR-0021): generated -> sent (the human sends it on
// LinkedIn by hand and marks it, D2) | dismissed. text+Zod (the churn-prone-set policy).
export const messageStatusSchema = z.enum(["generated", "sent", "dismissed"]);
export type MessageStatus = z.infer<typeof messageStatusSchema>;

export interface MessageRow {
  id: string;
  personId: string;
  type: string;
  body: string;
  status: string;
  createdAt: Date;
}

export async function listMessagesForPerson(personId: string): Promise<MessageRow[]> {
  return getDb()
    .select({
      id: messages.id,
      personId: messages.personId,
      type: messages.type,
      body: messages.body,
      status: messages.status,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .where(eq(messages.personId, personId))
    .orderBy(desc(messages.createdAt));
}

// The message lifecycle transitions (the human sends manually, then marks it, D2 - or discards it).
// Regenerate is not here: it is a fresh generateMessage call writing a new row.
async function setStatus(messageId: string, status: MessageStatus): Promise<void> {
  await getDb().update(messages).set({ status }).where(eq(messages.id, messageId));
}

export async function markMessageSent(messageId: string): Promise<void> {
  await setStatus(messageId, "sent");
}

export async function dismissMessage(messageId: string): Promise<void> {
  await setStatus(messageId, "dismissed");
}
