import "server-only";
import { and, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { rubric, scorings } from "@/lib/db/schema";
import { gateStatus, type Qualification } from "@/lib/qualify/status";

// The qualification read (ADR-0019/0020): qualification is derived from the latest icp-rubric
// Scoring, not stored on the Person. The "latest icp Scoring" is the newest scoring whose rubric
// has kind = 'icp' (scored_at desc, id desc as the tiebreak - same ordering the prospect read uses).
// A person with no icp Scoring is `unassessed`; otherwise gateStatus maps its score (>= 3) to
// qualified / below_bar. Reuses gateStatus so the >= 3 boundary lives in exactly one place.

function qualify(score: number | undefined): Qualification {
  return score === undefined ? "unassessed" : gateStatus(score);
}

export async function qualificationFor(personId: string): Promise<Qualification> {
  const [row] = await getDb()
    .select({ score: scorings.score })
    .from(scorings)
    .innerJoin(rubric, eq(rubric.id, scorings.rubricId))
    .where(and(eq(scorings.personId, personId), eq(rubric.kind, "icp")))
    .orderBy(desc(scorings.scoredAt), desc(scorings.id))
    .limit(1);
  return qualify(row?.score);
}

// Batch variant for the list read-model: one query over all the given people, returning each
// person's qualification. Avoids an N+1 of single-person reads when rendering the prospect grid.
export async function qualificationForMany(
  personIds: string[],
): Promise<Map<string, Qualification>> {
  const result = new Map<string, Qualification>();
  if (personIds.length === 0) return result;

  const rows = await getDb()
    .select({ personId: scorings.personId, score: scorings.score })
    .from(scorings)
    .innerJoin(rubric, eq(rubric.id, scorings.rubricId))
    .where(and(inArray(scorings.personId, personIds), eq(rubric.kind, "icp")))
    .orderBy(desc(scorings.scoredAt), desc(scorings.id));

  // Newest icp scoring per person wins (rows are ordered newest-first; first seen per person).
  const latest = new Map<string, number>();
  for (const r of rows) {
    if (!latest.has(r.personId)) latest.set(r.personId, r.score);
  }
  for (const id of personIds) {
    result.set(id, qualify(latest.get(id)));
  }
  return result;
}
