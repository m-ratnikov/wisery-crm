"use server";

import { revalidatePath } from "next/cache";
import { saveRubric, saveUserProfile } from "@/lib/icp/config";
import { rubricCriteriaSchema, userProfileSchema } from "@/lib/icp/schema";
import { seedIcpConfig } from "@/lib/icp/seed";
import { createSource, setSourceEnabled } from "@/lib/signals/sources";
import { enqueueScan } from "@/lib/signals/scan-queue";
import { isConnectorRegistered } from "@/lib/signals/registry";

// Server Actions for the config anchor view (icp-config D-E). Each validates with the
// config-as-data Zod schemas before persisting through src/lib/icp / src/lib/signals,
// then revalidates the route so the screen reflects the change.
//
// D1 (auth deferred, single-user MVP): these actions are intentionally unauthenticated.
// Server Actions are reachable by direct POST, so authorization MUST be added here at the
// productization milestone (the Next data-security caveat is acknowledged, not yet
// actionable while the app is single-user). This is the one place that decision surfaces.

const ROUTE = "/icp-config";

// FormData.get() can return a File; read only string fields, defaulting to "".
function field(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

// Parse a JSON field without letting a raw SyntaxError escape: invalid JSON becomes
// `undefined`, which the Zod schema then rejects as a clean validation error (Server
// Actions are reachable by direct POST, so the Zod boundary must own every rejection).
function parseJsonField(formData: FormData, key: string): unknown {
  try {
    return JSON.parse(field(formData, key) || "null");
  } catch {
    return undefined;
  }
}

export async function saveRubricAction(formData: FormData): Promise<void> {
  const name = field(formData, "name").trim();
  const criteria = rubricCriteriaSchema.parse(parseJsonField(formData, "criteria"));
  await saveRubric({ name: name || "ICP rubric", criteria });
  revalidatePath(ROUTE);
}

export async function saveProfileAction(formData: FormData): Promise<void> {
  const profile = userProfileSchema.parse(parseJsonField(formData, "profile"));
  await saveUserProfile(profile);
  revalidatePath(ROUTE);
}

export async function seedStarterAction(): Promise<void> {
  await seedIcpConfig();
  revalidatePath(ROUTE);
}

export async function toggleSourceAction(formData: FormData): Promise<void> {
  await setSourceEnabled(field(formData, "id"), field(formData, "enabled") === "true");
  revalidatePath(ROUTE);
}

export async function scanSourceAction(formData: FormData): Promise<void> {
  await enqueueScan(field(formData, "id"));
  revalidatePath(ROUTE);
}

export async function createSourceAction(formData: FormData): Promise<void> {
  // kind is constrained to registered connector kinds; today only the fixture connector
  // is registered. Real kinds (linkedin-search, x-posts) light up with source-adapters.
  const kind = field(formData, "kind").trim() || "fixture";
  if (!isConnectorRegistered(kind)) {
    // Defense in depth - the UI disables unregistered kinds, but a direct POST could set
    // one; reject so a source whose scan would be dead-on-arrival is never created.
    throw new Error(`source kind "${kind}" has no registered connector yet`);
  }
  const query = field(formData, "query").trim();
  const name = field(formData, "name").trim();
  await createSource({ kind, config: { name, query } });
  revalidatePath(ROUTE);
}
