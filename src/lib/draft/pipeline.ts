import "server-only";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { dossiers, drafts, prospects } from "@/lib/db/schema";
import { getUserProfile } from "@/lib/icp/config";
import type { LLMProvider } from "@/lib/llm/provider";
import { loadActionableProspect } from "@/lib/prospect/load";
import { draftMessage } from "@/lib/draft/drafter";

// The testable draft core (drafting D-C): draft a qualified prospect from the profile +
// signal, persist the selected draft (archiving any prior), and move the prospect to
// queued (ADR-0008). The LLM provider is injectable so tests run against the fake.
export interface DraftOutcome {
  prospectId: string;
  drafted: boolean;
  skipped: boolean;
}

export async function draftProspect(
  prospectId: string,
  opts: { llm?: LLMProvider; force?: boolean } = {},
): Promise<DraftOutcome> {
  const db = getDb();

  // Only a qualified or already-queued prospect is draftable; `queued` is allowed so a
  // re-draft (a user "regenerate" or enrichment's richer re-draft) can run on a prospect
  // already in the queue. A below-bar / acted / closed prospect skips.
  const loaded = await loadActionableProspect(prospectId);
  if (!loaded) {
    return { prospectId, drafted: false, skipped: true };
  }
  const { signal } = loaded;

  // Auto-draft idempotency (D-E): unless forced, a prospect that already has a selected
  // draft is left alone, so the automatic draft-on-qualify path never double-drafts. A
  // forced re-draft (opts.force) bypasses this to regenerate.
  if (!opts.force) {
    const existing = await db
      .select({ id: drafts.id })
      .from(drafts)
      .where(and(eq(drafts.prospectId, prospectId), eq(drafts.status, "selected")))
      .limit(1);
    if (existing.length > 0) {
      return { prospectId, drafted: false, skipped: true };
    }
  }

  const profile = await getUserProfile();
  if (!profile) {
    throw new Error("no user profile; seed or configure one before drafting");
  }
  // Ground the draft in the dossier when the prospect has been enriched (ADR-0007).
  const [dossier] = await db
    .select({ data: dossiers.data })
    .from(dossiers)
    .where(eq(dossiers.prospectId, prospectId))
    .limit(1);

  // Generate outside the transaction (no network inside a tx).
  const message = await draftMessage(signal, profile.profile, {
    llm: opts.llm,
    dossier: dossier?.data,
  });

  await db.transaction(async (tx) => {
    // Regenerability (ADR-0007): a new selected draft archives the prior selected one.
    await tx
      .update(drafts)
      .set({ status: "archived" })
      .where(and(eq(drafts.prospectId, prospectId), eq(drafts.status, "selected")));
    await tx.insert(drafts).values({
      prospectId,
      profileId: profile.id,
      body: message.body,
      status: "selected",
      provider: message.provider,
      promptVersion: message.promptVersion,
      model: message.model,
    });
    await tx.update(prospects).set({ status: "queued" }).where(eq(prospects.id, prospectId));
  });

  return { prospectId, drafted: true, skipped: false };
}
