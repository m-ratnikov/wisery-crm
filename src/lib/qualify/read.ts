import "server-only";
import { and, desc, eq, inArray, type SQL } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { rubric, scorings } from "@/lib/db/schema";
import { BUYER_RUBRIC_KIND } from "@/lib/icp/schema";
import { gateStatus, type Qualification } from "@/lib/qualify/status";

// The qualification read (ADR-0019/0020): qualification is derived from the latest icp-rubric
// Scoring, not stored on the Person. The single authoritative "latest icp-rubric Scoring" query
// (newest by scored_at, id-tiebreak) lives in `latestIcpScorings` so the qualification reads AND the
// prospect-list score-display reads all key on the same buyer-rubric-filtered shape - an `advisory`
// non-icp or peer-rubric row never satisfies a buyer qualification or shows as a buyer score.
// A person with no icp Scoring is `unassessed`; otherwise gateStatus maps its score (>= 3) to
// qualified / below_bar. gateStatus keeps the >= 3 boundary in exactly one place.

// rows are ordered newest-first; the caller takes the first per person as the latest.
export function latestIcpScorings(where?: SQL) {
  const kind = eq(rubric.kind, BUYER_RUBRIC_KIND);
  return getDb()
    .select({
      personId: scorings.personId,
      score: scorings.score,
      reason: scorings.reason,
      summary: scorings.summary,
    })
    .from(scorings)
    .innerJoin(rubric, eq(rubric.id, scorings.rubricId))
    .where(where ? and(where, kind) : kind)
    .orderBy(desc(scorings.scoredAt), desc(scorings.id));
}

function qualify(score: number | undefined): Qualification {
  return score === undefined ? "unassessed" : gateStatus(score);
}

export async function qualificationFor(personId: string): Promise<Qualification> {
  const [row] = await latestIcpScorings(eq(scorings.personId, personId)).limit(1);
  return qualify(row?.score);
}

// Batch variant for the list read-model: one query over all the given people, returning each
// person's qualification. Avoids an N+1 of single-person reads when rendering the prospect grid.
export async function qualificationForMany(
  personIds: string[],
): Promise<Map<string, Qualification>> {
  const result = new Map<string, Qualification>();
  if (personIds.length === 0) return result;

  const rows = await latestIcpScorings(inArray(scorings.personId, personIds));
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
