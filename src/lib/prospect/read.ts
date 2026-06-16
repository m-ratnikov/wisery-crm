import "server-only";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { dossiers, person, pipelineStatus, signals, sources } from "@/lib/db/schema";

// The prospect-list read-model (prospect-list D-A/D-B): one row per prospect with its pipeline
// position (the pipeline_status NAME, ADR-0020), source, and the DERIVED enriched facet (a dossier
// exists - ADR-0008, not a status). Drafting was retired (ADR-0019), and people carry no score or
// qualification (ADR-0022: the advisory score stays on the signal). Composed from small queries to
// avoid join multiplicity.

export interface ProspectListItem {
  id: string;
  status: string;
  origin: string;
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

  const enrichedIds = new Set(
    (await db.select({ id: dossiers.personId }).from(dossiers)).map((r) => r.id),
  );

  return base.map((r) => ({
    id: r.id,
    status: r.status,
    origin: r.origin,
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
  name: string;
  dossier: unknown;
  createdAt: Date;
}

export async function getProspectDetail(personId: string): Promise<ProspectDetail | null> {
  const db = getDb();
  const [p] = await prospectsWithSignal().where(eq(person.id, personId)).limit(1);
  if (!p) return null;

  const [dos] = await db
    .select({ data: dossiers.data })
    .from(dossiers)
    .where(eq(dossiers.personId, personId))
    .limit(1);

  return {
    id: p.id,
    status: p.status,
    name: displayName(p),
    dossier: dos?.data ?? null,
    createdAt: p.createdAt,
  };
}
