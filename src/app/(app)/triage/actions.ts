"use server";

import { revalidatePath } from "next/cache";
import { enqueueQualifyProspectInTx } from "@/lib/qualify/qualify-queue";
import { approveSignal, dismissSignal } from "@/lib/triage/decide";

// Server Actions for the Queue triage lane (universal-triage, ADR-0013). Approve routes the signal
// by kind and (for a prospect) enqueues qualify in the same transaction; dismiss records the verdict.
// D1: unauthenticated by design (single-user MVP) - authorization is added at productization.

const ROUTE = "/triage";

function field(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v : "";
}

export async function approveAction(formData: FormData): Promise<void> {
  await approveSignal(field(formData, "id"), {
    enqueueQualify: async (tx, personId) => {
      await enqueueQualifyProspectInTx(tx, personId);
    },
  });
  revalidatePath(ROUTE);
}

export async function dismissAction(formData: FormData): Promise<void> {
  await dismissSignal(field(formData, "id"));
  revalidatePath(ROUTE);
}
