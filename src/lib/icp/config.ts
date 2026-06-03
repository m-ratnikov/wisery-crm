import "server-only";
import { desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { rubric, userProfile } from "@/lib/db/schema";
import {
  type RubricCriteria,
  rubricCriteriaSchema,
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

export async function getActiveRubric(): Promise<ActiveRubric | null> {
  // The partial unique index guarantees one active row; ordering by version makes the
  // "highest version" intent explicit and correct even if the index were ever absent.
  const [row] = await getDb()
    .select()
    .from(rubric)
    .where(eq(rubric.active, true))
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
    await tx.update(rubric).set({ active: false }).where(eq(rubric.active, true));
    const [{ max }] = await tx
      .select({ max: sql<number>`coalesce(max(${rubric.version}), 0)::int` })
      .from(rubric);
    const [row] = await tx
      .insert(rubric)
      .values({ name: input.name, rubric: criteria, version: max + 1, active: true })
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
