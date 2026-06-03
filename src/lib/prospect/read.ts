import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { dossiers, drafts, prospects, scorings, signals, sources } from "@/lib/db/schema";

// The prospect-list read-model (prospect-list D-A/D-B): one row per prospect with its
// disposition, latest score, source, and the DERIVED enriched/drafted facets (a dossier /
// a selected draft exists - ADR-0008, not a status). Composed from small queries to avoid
// join multiplicity when a prospect has been re-scored or re-drafted.

export interface ProspectListItem {
  id: string;
  status: string;
  score: number | null;
  summary: string | null;
  sourceKind: string;
  name: string;
  enriched: boolean;
  drafted: boolean;
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

// Base query: each prospect joined to its signal (payload + kind). Shared by the detail
// read and the queue read; chain .where / .orderBy / .limit. (listProspects adds sources.)
export function prospectsWithSignal() {
  return getDb()
    .select({
      id: prospects.id,
      status: prospects.status,
      createdAt: prospects.createdAt,
      payload: signals.payload,
      signalKind: signals.kind,
    })
    .from(prospects)
    .innerJoin(signals, eq(signals.id, prospects.signalId));
}

export async function listProspects(): Promise<ProspectListItem[]> {
  const db = getDb();

  const base = await db
    .select({
      id: prospects.id,
      status: prospects.status,
      createdAt: prospects.createdAt,
      signalKind: signals.kind,
      payload: signals.payload,
      sourceKind: sources.kind,
    })
    .from(prospects)
    .innerJoin(signals, eq(signals.id, prospects.signalId))
    .innerJoin(sources, eq(sources.id, signals.sourceId))
    .orderBy(desc(prospects.createdAt));

  // Latest scoring per prospect (newest first; first seen wins).
  const scoreRows = await db
    .select({ prospectId: scorings.prospectId, score: scorings.score, summary: scorings.summary })
    .from(scorings)
    .orderBy(desc(scorings.scoredAt), desc(scorings.id));
  const latestScore = new Map<string, { score: number; summary: string | null }>();
  for (const r of scoreRows) {
    if (!latestScore.has(r.prospectId))
      latestScore.set(r.prospectId, { score: r.score, summary: r.summary });
  }

  const enrichedIds = new Set(
    (await db.select({ id: dossiers.prospectId }).from(dossiers)).map((r) => r.id),
  );
  const draftedIds = new Set(
    (
      await db.select({ id: drafts.prospectId }).from(drafts).where(eq(drafts.status, "selected"))
    ).map((r) => r.id),
  );

  return base.map((r) => ({
    id: r.id,
    status: r.status,
    score: latestScore.get(r.id)?.score ?? null,
    summary: latestScore.get(r.id)?.summary ?? null,
    sourceKind: r.sourceKind,
    name: nameFromPayload(r.payload, r.signalKind),
    enriched: enrichedIds.has(r.id),
    drafted: draftedIds.has(r.id),
    createdAt: r.createdAt,
  }));
}

export interface ProspectDetail {
  id: string;
  status: string;
  name: string;
  score: number | null;
  reason: string | null;
  summary: string | null;
  draft: string | null;
  dossier: unknown;
  createdAt: Date;
}

export async function getProspectDetail(prospectId: string): Promise<ProspectDetail | null> {
  const db = getDb();
  const [p] = await prospectsWithSignal().where(eq(prospects.id, prospectId)).limit(1);
  if (!p) return null;

  const [sc] = await db
    .select({ score: scorings.score, reason: scorings.reason, summary: scorings.summary })
    .from(scorings)
    .where(eq(scorings.prospectId, prospectId))
    .orderBy(desc(scorings.scoredAt), desc(scorings.id))
    .limit(1);
  const [dr] = await db
    .select({ body: drafts.body })
    .from(drafts)
    .where(and(eq(drafts.prospectId, prospectId), eq(drafts.status, "selected")))
    .limit(1);
  const [dos] = await db
    .select({ data: dossiers.data })
    .from(dossiers)
    .where(eq(dossiers.prospectId, prospectId))
    .limit(1);

  return {
    id: p.id,
    status: p.status,
    name: nameFromPayload(p.payload, p.signalKind),
    score: sc?.score ?? null,
    reason: sc?.reason ?? null,
    summary: sc?.summary ?? null,
    draft: dr?.body ?? null,
    dossier: dos?.data ?? null,
    createdAt: p.createdAt,
  };
}
