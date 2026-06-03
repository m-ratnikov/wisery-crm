"use server";

import { revalidatePath } from "next/cache";
import { enqueueDraft } from "@/lib/draft/draft-queue";
import { enqueueEnrich, enqueueEnrichForProspects } from "@/lib/enrich/enrich-queue";
import { setAutoEnrich } from "@/lib/enrich/settings";

// Server Actions for the prospect-list anchor view (prospect-list D-D): thin wrappers over
// the built enrichment/drafting/settings entry points, each revalidating the route.
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

export async function regenerateDraftAction(formData: FormData): Promise<void> {
  await enqueueDraft(field(formData, "id"), true);
  revalidatePath(ROUTE);
}

export async function setAutoEnrichAction(formData: FormData): Promise<void> {
  await setAutoEnrich(field(formData, "autoEnrich") === "true");
  revalidatePath(ROUTE);
}
