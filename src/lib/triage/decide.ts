import "server-only";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, type DbTx } from "@/lib/db";
import { companies, person, posts, signalDecisions } from "@/lib/db/schema";
import { dedupKeyFor } from "@/lib/posts/dedup";
import { loadSignalById } from "@/lib/signals/load";

// The triage verdict vocabulary (ADR-0014): text + Zod - the column has no DB enum.
// `created_entity_id` is set only for an approval.
export const signalDispositionSchema = z.enum(["approved", "dismissed"]);
export type SignalDisposition = z.infer<typeof signalDispositionSchema>;

// Triage approve / dismiss (universal-triage, ADR-0013/0014/0016/0018). Approval routes a signal by
// kind into exactly the right entity in ONE transaction (ADR-0009): person -> Person(prospect) +
// enqueue qualify; company -> Company; content -> author Person(peer) + Post. `created_entity_id`
// records the single primary entity. A dismissal records the verdict so a re-scan cannot resurface
// the signal. Both are idempotent on the signal's existing decision (the unique signal_id).

type EnqueueQualify = (tx: DbTx, personId: string) => Promise<void>;

function payloadStr(payload: unknown, key: string): string | null {
  if (payload && typeof payload === "object" && key in payload) {
    const v = (payload as Record<string, unknown>)[key];
    return typeof v === "string" ? v : null;
  }
  return null;
}

export interface ApproveOutcome {
  signalId: string;
  kind: string;
  createdEntityId: string | null;
  alreadyDecided: boolean;
}

export async function approveSignal(
  signalId: string,
  opts: { enqueueQualify?: EnqueueQualify } = {},
): Promise<ApproveOutcome> {
  const db = getDb();
  const signal = await loadSignalById(signalId);

  // Idempotency: a signal already triaged is left untouched, so a double-approve never creates a
  // second entity (the scanner re-encounters the same signal every run, ADR-0014).
  const existing = await db
    .select({ id: signalDecisions.id })
    .from(signalDecisions)
    .where(eq(signalDecisions.signalId, signalId))
    .limit(1);
  if (existing.length > 0) {
    return { signalId, kind: signal.kind, createdEntityId: null, alreadyDecided: true };
  }

  const createdEntityId = await db.transaction(async (tx) => {
    let primaryId: string;
    if (signal.kind === "company") {
      const name =
        payloadStr(signal.payload, "name") ??
        payloadStr(signal.payload, "company") ??
        "Unknown company";
      const [c] = await tx
        .insert(companies)
        .values({ signalId, name })
        .returning({ id: companies.id });
      primaryId = c.id;
    } else if (signal.kind === "content") {
      // The post's author becomes a peer; the signal's content becomes a Post attached to them.
      const [p] = await tx
        .insert(person)
        .values({ type: "peer", origin: "signal", signalId, status: "new" })
        .returning({ id: person.id });
      primaryId = p.id;
      const externalUrl =
        payloadStr(signal.payload, "url") ??
        payloadStr(signal.payload, "externalUrl") ??
        `signal:${signalId}`;
      await tx
        .insert(posts)
        .values({
          personId: p.id,
          externalUrl,
          dedupKey: dedupKeyFor({ externalUrl }) ?? `signal:${signalId}`,
          content: payloadStr(signal.payload, "content") ?? "",
        })
        .onConflictDoNothing({ target: [posts.personId, posts.dedupKey] });
    } else {
      // person (and job, pragmatically): create a prospect and enqueue qualification in this tx.
      const [p] = await tx
        .insert(person)
        .values({ type: "prospect", origin: "signal", signalId, status: "new" })
        .returning({ id: person.id });
      primaryId = p.id;
      if (opts.enqueueQualify) await opts.enqueueQualify(tx, p.id);
    }
    await tx.insert(signalDecisions).values({
      signalId,
      disposition: signalDispositionSchema.enum.approved,
      createdEntityId: primaryId,
    });
    return primaryId;
  });

  return { signalId, kind: signal.kind, createdEntityId, alreadyDecided: false };
}

export async function dismissSignal(signalId: string): Promise<{ alreadyDecided: boolean }> {
  const result = await getDb()
    .insert(signalDecisions)
    .values({ signalId, disposition: signalDispositionSchema.enum.dismissed })
    .onConflictDoNothing({ target: signalDecisions.signalId })
    .returning({ id: signalDecisions.id });
  return { alreadyDecided: result.length === 0 };
}
