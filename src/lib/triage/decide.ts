import "server-only";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db";
import {
  companies,
  person,
  posts,
  scorings,
  signalAdvisory,
  signalDecisions,
} from "@/lib/db/schema";
import { getActiveRubric } from "@/lib/icp/config";
import { rubricKindSchema } from "@/lib/icp/schema";
import { dedupKeyFor } from "@/lib/posts/dedup";
import { gateStatus } from "@/lib/qualify/status";
import { loadSignalById } from "@/lib/signals/load";

// The triage verdict vocabulary (ADR-0014): text + Zod - the column has no DB enum.
// `created_entity_id` is set only for an approval.
export const signalDispositionSchema = z.enum(["approved", "dismissed"]);
export type SignalDisposition = z.infer<typeof signalDispositionSchema>;

// Triage approve / dismiss (universal-triage, ADR-0013/0014/0016/0018; promotion ADR-0019). Approval
// routes a signal by kind into exactly the right entity in ONE transaction (ADR-0009): person ->
// Person(prospect); company -> Company; content -> author Person(peer) + Post. For a person/peer it
// also promotes the advisory score into the person's initial Scoring (no LLM, provenance `advisory`)
// when an active rubric of the advisory's kind exists. `created_entity_id` records the single primary
// entity. A dismissal records the verdict so a re-scan cannot resurface the signal. Both are
// idempotent on the signal's existing decision (the unique signal_id).

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

export async function approveSignal(signalId: string): Promise<ApproveOutcome> {
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

  // Resolve everything needed to promote the advisory score BEFORE the transaction opens, so the tx
  // stays write-only and never waits on a second pooled connection (ADR-0009). The advisory row
  // carries the rubric_kind and a nullable score; the active rubric of that kind gives the rubric_id
  // a Scoring requires. A company signal promotes nothing (ADR-0017's company-rubric-no-Scoring).
  const [advisory] =
    signal.kind === "company"
      ? [undefined]
      : await db
          .select({
            rubricKind: signalAdvisory.rubricKind,
            score: signalAdvisory.score,
            reason: signalAdvisory.reason,
          })
          .from(signalAdvisory)
          .where(eq(signalAdvisory.signalId, signalId))
          .limit(1);
  // The advisory rubric_kind is free DB text; degrade to no-promotion on an unexpected value
  // (safeParse, not parse) so a data-drift kind can never throw and abort the approval.
  const advisoryKind = advisory ? rubricKindSchema.safeParse(advisory.rubricKind) : undefined;
  const promotionRubric = advisoryKind?.success ? await getActiveRubric(advisoryKind.data) : null;
  // When the advisory is promoted, derive the person's disposition from its score the same way a
  // re-score does (gateStatus), so a qualifying approved person is actionable (enrichable) without
  // a second LLM pass; absent a promotable advisory the person stays `new` (unassessed). Slice 2
  // replaces this text status with the configurable pipeline FK.
  const promotes = signal.kind !== "company" && advisory != null && promotionRubric != null;
  const initialStatus = promotes ? gateStatus(advisory.score ?? -1) : "new";

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
        .values({ type: "peer", origin: "signal", signalId, status: initialStatus })
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
      // person (and job, pragmatically): create a prospect.
      const [p] = await tx
        .insert(person)
        .values({ type: "prospect", origin: "signal", signalId, status: initialStatus })
        .returning({ id: person.id });
      primaryId = p.id;
    }
    // Promote the advisory into the person's initial Scoring (ADR-0019): no LLM, provenance
    // `advisory`, the `advisory` sentinel in provider/prompt/model. Only when a rubric of the
    // advisory's kind exists; absent it the person reads `unassessed` and approval still succeeds.
    if (promotes) {
      await tx.insert(scorings).values({
        personId: primaryId,
        rubricId: promotionRubric.id,
        score: advisory.score ?? -1,
        reason: advisory.reason,
        provenance: "advisory",
        provider: "advisory",
        promptVersion: "advisory",
        model: "advisory",
      });
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
