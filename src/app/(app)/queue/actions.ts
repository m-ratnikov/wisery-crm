"use server";

import { revalidatePath } from "next/cache";
import { approveSignal, dismissSignal } from "@/lib/triage/decide";

// Server Actions for the unified Queue (universal-triage, ADR-0013; on-demand scoring, ADR-0019).
// Approve routes the signal by kind into the right entity and promotes the advisory score into the
// person's initial Scoring inside the same transaction (no queue handoff); dismiss records the verdict.
// D1: unauthenticated by design (single-user MVP) - authorization is added at productization.

const ROUTE = "/queue";

function field(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v : "";
}

export async function approveAction(formData: FormData): Promise<void> {
  await approveSignal(field(formData, "id"));
  revalidatePath(ROUTE);
}

export async function dismissAction(formData: FormData): Promise<void> {
  await dismissSignal(field(formData, "id"));
  revalidatePath(ROUTE);
}
