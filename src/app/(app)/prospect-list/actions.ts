"use server";

import { revalidatePath } from "next/cache";
import { generateComment } from "@/lib/comments/generate";
import { dismissComment, markCommentPosted } from "@/lib/comments/read";
import { enqueueEnrich, enqueueEnrichForProspects } from "@/lib/enrich/enrich-queue";
import { setAutoEnrich } from "@/lib/enrich/settings";
import { setMonitored } from "@/lib/posts/pipeline";
import { enqueueFetchPosts } from "@/lib/posts/posts-queue";
import { addManualLead } from "@/lib/prospect/manual";
import { qualifyProspect } from "@/lib/qualify/pipeline";

// Server Actions for the prospect-list anchor view (prospect-list D-D): thin wrappers over
// the built enrichment/scoring/settings entry points, each revalidating the route.
//
// D1: unauthenticated by design (single-user MVP). Server Actions are reachable by direct
// POST, so authorization MUST be added here at the productization milestone. This is the
// one place that decision surfaces for this view.

const ROUTE = "/prospect-list";

function field(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v : "";
}

function fields(formData: FormData, key: string): string[] {
  return formData.getAll(key).filter((v): v is string => typeof v === "string");
}

export async function enrichAction(formData: FormData): Promise<void> {
  await enqueueEnrich(field(formData, "id"));
  revalidatePath(ROUTE);
}

export async function batchEnrichAction(formData: FormData): Promise<void> {
  await enqueueEnrichForProspects(fields(formData, "id"));
  revalidatePath(ROUTE);
}

export async function setAutoEnrichAction(formData: FormData): Promise<void> {
  await setAutoEnrich(field(formData, "autoEnrich") === "true");
  revalidatePath(ROUTE);
}

// Add a lead by hand (ADR-0010): persist the manual prospect only. It does NOT auto-score
// (ADR-0019) - a hand-created person has no advisory to promote and no reason to spend an LLM
// call unasked; it starts `new` and is scored when the user clicks Re-score.
export async function addLeadAction(formData: FormData): Promise<void> {
  await addManualLead({
    name: field(formData, "name"),
    headline: field(formData, "headline") || undefined,
    company: field(formData, "company") || undefined,
    linkedinUrl: field(formData, "linkedinUrl") || undefined,
  });
  revalidatePath(ROUTE);
}

// Re-score a person on demand (ADR-0019): synchronous, user-triggered. The user waits and gets a
// fresh `llm`-provenance Scoring superseding any prior (advisory or llm) row; an error surfaces to
// the user with no background retry. This is the single on-demand scoring action.
export async function reScoreAction(formData: FormData): Promise<void> {
  await qualifyProspect(field(formData, "id"));
  revalidatePath(ROUTE);
}

// Engagement (engagement-posts, ADR-0018). "Get latest posts": enqueue a fetch-posts job
// fire-and-forget (ADR-0007 user-triggered pattern); the worker stores them idempotently.
export async function fetchPostsAction(formData: FormData): Promise<void> {
  const id = field(formData, "id");
  await enqueueFetchPosts(id);
  revalidatePath(`${ROUTE}/${id}`);
}

// Flag / unflag a person as `monitored` (the people the Feed watches). A quick DB write.
export async function monitorAction(formData: FormData): Promise<void> {
  const id = field(formData, "id");
  await setMonitored(id, field(formData, "monitored") === "true");
  revalidatePath(`${ROUTE}/${id}`);
}

// Comments (engagement-comments, ADR-0018). Generation is a SYNCHRONOUS server action (not a queue
// job): the user waits and gets a draft; each call writes a new Comment row. The human posts it on
// the channel by hand, then marks it posted (D2) - the system never auto-posts.
export async function generateCommentAction(formData: FormData): Promise<void> {
  await generateComment(field(formData, "postId"));
  revalidatePath(`${ROUTE}/${field(formData, "personId")}`);
}

export async function markCommentPostedAction(formData: FormData): Promise<void> {
  await markCommentPosted(field(formData, "commentId"));
  revalidatePath(`${ROUTE}/${field(formData, "personId")}`);
}

export async function dismissCommentAction(formData: FormData): Promise<void> {
  await dismissComment(field(formData, "commentId"));
  revalidatePath(`${ROUTE}/${field(formData, "personId")}`);
}
