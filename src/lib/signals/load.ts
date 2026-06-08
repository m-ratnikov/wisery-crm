import "server-only";
import { eq, type InferSelectModel } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { signals } from "@/lib/db/schema";

type Signal = InferSelectModel<typeof signals>;

// Load a signal by id or throw a precondition error (the worker/caller retries). One representation,
// shared by the advisory filter and the triage decision so they cannot drift.
export async function loadSignalById(signalId: string): Promise<Signal> {
  const [signal] = await getDb().select().from(signals).where(eq(signals.id, signalId)).limit(1);
  if (!signal) throw new Error(`signal ${signalId} not found`);
  return signal;
}
