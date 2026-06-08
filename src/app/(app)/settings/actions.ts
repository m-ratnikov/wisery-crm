"use server";

import { revalidatePath } from "next/cache";
import { saveGuidance } from "@/lib/comments/guidance";
import { setAutoEnrich } from "@/lib/enrich/settings";

// Server Action for the settings screen: persists the auto-enrich flag through the existing
// settings seam (src/lib/enrich/settings.ts), the single authoritative writer of that row.
// An unchecked checkbox submits no value, so absence means off.
//
// D1: unauthenticated by design (single-user MVP). Reachable by direct POST, so authorization
// MUST be added here at the productization milestone (matches the other wired actions).

export async function saveSettingsAction(formData: FormData): Promise<void> {
  await setAutoEnrich(formData.get("autoEnrich") === "on");
  revalidatePath("/settings");
}

function field(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v : "";
}

// Save the global comment guidance (engagement-comments, ADR-0018) as a new active version. Rules
// are entered one per line; the tone is free text.
export async function saveGuidanceAction(formData: FormData): Promise<void> {
  const tone = field(formData, "tone").trim();
  const rules = field(formData, "rules")
    .split("\n")
    .map((r) => r.trim())
    .filter(Boolean);
  await saveGuidance({ tone, rules });
  revalidatePath("/settings");
}
