"use server";

import { revalidatePath } from "next/cache";
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
