import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { rubric, userProfile } from "@/lib/db/schema";
import {
  type RubricCriteria,
  rubricCriteriaSchema,
  type RubricKind,
  type SaveRubricInput,
  type UserProfileData,
  userProfileSchema,
} from "@/lib/icp/schema";

// Config-as-data read/write (icp-config D-B/D-D). Edits are additive new versions, never
// updates in place, so a past Scoring's rubric is never rewritten. Reads validate the
// JSONB against the Zod schema at the boundary.

export interface ActiveRubric {
  id: string;
  name: string;
  version: number;
  criteria: RubricCriteria;
}

export async function getActiveRubric(kind: RubricKind = "icp"): Promise<ActiveRubric | null> {
  // The partial unique index guarantees one active row per kind (ADR-0017); ordering by version
  // makes the "highest version" intent explicit. Defaults to `icp` so the qualifier's existing
  // callers are unchanged; the advisory filter passes `peer`/`company` for those intents.
  const [row] = await getDb()
    .select()
    .from(rubric)
    .where(and(eq(rubric.active, true), eq(rubric.kind, kind)))
    .orderBy(desc(rubric.version))
    .limit(1);
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    version: row.version,
    criteria: rubricCriteriaSchema.parse(row.rubric),
  };
}

export async function saveRubric(input: SaveRubricInput): Promise<ActiveRubric> {
  const criteria = rubricCriteriaSchema.parse(input.criteria);
  return getDb().transaction(async (tx) => {
    // Deactivate the current active row and insert the next version as active, atomically,
    // so the one-active-rubric invariant (and its partial unique index) always holds.
    // Concurrency: the safety comes from the partial unique index, not the version
    // arithmetic - two simultaneous saves would compute the same next version, and the
    // index makes the loser fail (to retry) rather than create a second active row.
    // Acceptable under D1 (single-user); revisit if concurrent editors ever exist.
    // The icp-config UI edits the ICP (buyer) rubric; scope the deactivate + version to kind=icp so
    // a future active peer/company rubric is untouched (ADR-0017).
    await tx
      .update(rubric)
      .set({ active: false })
      .where(and(eq(rubric.active, true), eq(rubric.kind, "icp")));
    const [{ max }] = await tx
      .select({ max: sql<number>`coalesce(max(${rubric.version}), 0)::int` })
      .from(rubric)
      .where(eq(rubric.kind, "icp"));
    const [row] = await tx
      .insert(rubric)
      .values({ name: input.name, kind: "icp", rubric: criteria, version: max + 1, active: true })
      .returning();
    return { id: row.id, name: row.name, version: row.version, criteria };
  });
}

export interface ProfileResult {
  id: string;
  version: number;
  profile: UserProfileData;
}

export async function getUserProfile(): Promise<ProfileResult | null> {
  const [row] = await getDb()
    .select()
    .from(userProfile)
    .orderBy(desc(userProfile.version))
    .limit(1);
  if (!row) return null;
  return { id: row.id, version: row.version, profile: userProfileSchema.parse(row.profile) };
}

export async function saveUserProfile(input: UserProfileData): Promise<ProfileResult> {
  const profile = userProfileSchema.parse(input);
  return getDb().transaction(async (tx) => {
    const [{ max }] = await tx
      .select({ max: sql<number>`coalesce(max(${userProfile.version}), 0)::int` })
      .from(userProfile);
    const [row] = await tx
      .insert(userProfile)
      .values({ profile, version: max + 1 })
      .returning();
    return { id: row.id, version: row.version, profile };
  });
}
