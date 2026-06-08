import "server-only";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { dossiers, person, pipelineStatus, scorings, signals, sources } from "@/lib/db/schema";
import { latestIcpScorings, qualificationForMany } from "@/lib/qualify/read";
import type { Qualification } from "@/lib/qualify/status";

// The prospect-list read-model (prospect-list D-A/D-B): one row per prospect with its pipeline
// position (the pipeline_status NAME, ADR-0020), its derived qualification (ADR-0019, distinct from
// the pipeline position), latest score, source, and the DERIVED enriched facet (a dossier exists -
// ADR-0008, not a status). Drafting was retired (ADR-0019), so there is no drafted facet. Composed
// from small queries to avoid join multiplicity when a prospect has been re-scored.

export interface ProspectListItem {
  id: string;
  status: string;
  qualification: Qualification;
  origin: string;
  score: number | null;
  summary: string | null;
  sourceKind: string;
  name: string;
  enriched: boolean;
  createdAt: Date;
}

// The signal payload is opaque JSONB; pull a display name defensively, else fall back.
export function nameFromPayload(payload: unknown, fallback: string): string {
  if (payload && typeof payload === "object" && "name" in payload) {
    const n = (payload as { name?: unknown }).name;
    if (typeof n === "string" && n.length > 0) return n;
  }
  return fallback;
}

// Origin-agnostic display name (ADR-0010): a manual prospect's name lives in its column;
// a discovered one's lives in its signal payload. One place the read-models branch on origin.
export function displayName(row: {
  origin: string;
  manualName: string | null;
  payload: unknown;
  signalKind: string | null;
}): string {
  if (row.origin === "manual") {
    return row.manualName && row.manualName.length > 0 ? row.manualName : "(unnamed lead)";
  }
  return nameFromPayload(row.payload, row.signalKind ?? "");
}

// Base query: each prospect LEFT-joined to its signal, so a manual prospect (no signal,
// ADR-0010) is not dropped; signal payload/kind are null for it and identity comes from its
// own columns via displayName(). Shared by the detail read and the queue read; chain
// .where / .orderBy / .limit. (listProspects adds sources.)
export function prospectsWithSignal() {
  return getDb()
    .select({
      id: person.id,
      // status is the pipeline_status NAME (ADR-0020), resolved by the composite FK join; never null
      // for a persisted person (status_id is NOT NULL).
      status: pipelineStatus.name,
      createdAt: person.createdAt,
      origin: person.origin,
      manualName: person.name,
      payload: signals.payload,
      signalKind: signals.kind,
    })
    .from(person)
    .innerJoin(pipelineStatus, eq(pipelineStatus.id, person.statusId))
    .leftJoin(signals, eq(signals.id, person.signalId));
}

export async function listProspects(): Promise<ProspectListItem[]> {
  const db = getDb();

  const base = await db
    .select({
      id: person.id,
      status: pipelineStatus.name,
      createdAt: person.createdAt,
      origin: person.origin,
      manualName: person.name,
      signalKind: signals.kind,
      payload: signals.payload,
      sourceKind: sources.kind,
    })
    .from(person)
    .innerJoin(pipelineStatus, eq(pipelineStatus.id, person.statusId))
    .leftJoin(signals, eq(signals.id, person.signalId))
    .leftJoin(sources, eq(sources.id, signals.sourceId))
    .orderBy(desc(person.createdAt));

  // Latest icp-rubric scoring per prospect (newest first; first seen wins), via the shared
  // buyer-rubric-filtered query so the displayed score is the same Scoring that drives the
  // qualification badge - a peer-rubric or advisory non-icp row never shows a score next to an
  // `unassessed` qualification (ADR-0019: every score/qualification read filters by rubric kind).
  const scoreRows = await latestIcpScorings();
  const latestScore = new Map<string, { score: number; summary: string | null }>();
  for (const r of scoreRows) {
    if (!latestScore.has(r.personId))
      latestScore.set(r.personId, { score: r.score, summary: r.summary });
  }

  const enrichedIds = new Set(
    (await db.select({ id: dossiers.personId }).from(dossiers)).map((r) => r.id),
  );

  // Qualification is the read over the latest icp Scoring (ADR-0019), orthogonal to the pipeline
  // position; computed in one batch query to avoid an N+1 over the grid.
  const qualifications = await qualificationForMany(base.map((r) => r.id));

  return base.map((r) => ({
    id: r.id,
    status: r.status,
    qualification: qualifications.get(r.id) ?? "unassessed",
    origin: r.origin,
    score: latestScore.get(r.id)?.score ?? null,
    summary: latestScore.get(r.id)?.summary ?? null,
    // A manual prospect has no source; label it so the UI has a chip (ADR-0010).
    sourceKind: r.sourceKind ?? "manual",
    name: displayName(r),
    enriched: enrichedIds.has(r.id),
    createdAt: r.createdAt,
  }));
}

export interface ProspectDetail {
  id: string;
  status: string;
  qualification: Qualification;
  name: string;
  score: number | null;
  reason: string | null;
  summary: string | null;
  dossier: unknown;
  createdAt: Date;
}

export async function getProspectDetail(personId: string): Promise<ProspectDetail | null> {
  const db = getDb();
  const [p] = await prospectsWithSignal().where(eq(person.id, personId)).limit(1);
  if (!p) return null;

  const [sc] = await latestIcpScorings(eq(scorings.personId, personId)).limit(1);
  const [dos] = await db
    .select({ data: dossiers.data })
    .from(dossiers)
    .where(eq(dossiers.personId, personId))
    .limit(1);
  const qualification = (await qualificationForMany([personId])).get(personId) ?? "unassessed";

  return {
    id: p.id,
    status: p.status,
    qualification,
    name: displayName(p),
    score: sc?.score ?? null,
    reason: sc?.reason ?? null,
    summary: sc?.summary ?? null,
    dossier: dos?.data ?? null,
    createdAt: p.createdAt,
  };
}
