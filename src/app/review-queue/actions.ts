"use server";

import { revalidatePath } from "next/cache";
import {
  actProspect,
  dismissProspect,
  logOutcome,
  type OutcomeResultValue,
} from "@/lib/queue/transitions";

// Server Actions for the review queue (review-queue D-D): thin wrappers over the disposition
// transitions, each revalidating the route. The system never sends - acting only records
// that the human acted (D2).
//
// D1: unauthenticated by design (single-user MVP). Server Actions are reachable by direct
// POST, so authorization MUST be added here at the productization milestone.

const ROUTE = "/review-queue";
const RESULTS: OutcomeResultValue[] = ["connected", "replied", "booked", "no_response"];

function field(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v : "";
}

export async function actAction(formData: FormData): Promise<void> {
  await actProspect(field(formData, "id"));
  revalidatePath(ROUTE);
}

export async function dismissAction(formData: FormData): Promise<void> {
  await dismissProspect(field(formData, "id"));
  revalidatePath(ROUTE);
}

export async function logOutcomeAction(formData: FormData): Promise<void> {
  const result = field(formData, "result");
  if (!RESULTS.includes(result as OutcomeResultValue)) return; // ignore an invalid result
  await logOutcome(field(formData, "id"), {
    result: result as OutcomeResultValue,
    notes: field(formData, "notes") || undefined,
  });
  revalidatePath(ROUTE);
}
