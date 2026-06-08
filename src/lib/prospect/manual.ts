import "server-only";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { person } from "@/lib/db/schema";

// Manual lead entry (ADR-0010): the CRM user adds a known person by hand. `name` is required
// (the per-origin CHECK enforces it for origin = manual); the rest is optional identity. The
// prospect is born `origin = manual`, no signal, status `new`, then qualified by personId.
// `origin` itself is code-set (never user input), so it needs no input-Zod.
export const manualLeadSchema = z.object({
  name: z.string().trim().min(1, "name is required"),
  headline: z.string().trim().optional(),
  company: z.string().trim().optional(),
  linkedinUrl: z.string().trim().optional(),
});
export type ManualLeadInput = z.infer<typeof manualLeadSchema>;

function orNull(v: string | undefined): string | null {
  return v && v.length > 0 ? v : null;
}

export async function addManualLead(input: ManualLeadInput): Promise<string> {
  const parsed = manualLeadSchema.parse(input);
  const [row] = await getDb()
    .insert(person)
    .values({
      origin: "manual",
      status: "new",
      name: parsed.name,
      headline: orNull(parsed.headline),
      company: orNull(parsed.company),
      linkedinUrl: orNull(parsed.linkedinUrl),
    })
    .returning({ id: person.id });
  return row.id;
}
