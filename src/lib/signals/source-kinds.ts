import "server-only";
import { z } from "zod";
import { isConnectorRegistered } from "@/lib/signals/registry";
import { linkedinJobsConfigSchema } from "@/lib/signals/source-kind-schemas";

// The per-kind settings contract (source-connection). Each source kind declares what it
// needs configured: a label, renderable field descriptors (for the wizard), and a Zod
// schema (server-authoritative validation). This is the config front door to the scan
// pipeline; it does not touch the SignalSource.scan contract. Joined to the connector
// registry by the `kind` string - a kind is connectable only when its connector is
// registered, so a connected source can always be scanned.

export type SourceFieldType = "text" | "textarea";

export interface SourceField {
  name: string;
  label: string;
  type: SourceFieldType;
  placeholder?: string;
  required?: boolean;
}

export interface SourceKindDef {
  kind: string;
  label: string;
  fields: SourceField[];
  configSchema: z.ZodTypeAny;
}

// Client-safe projection: descriptors only, no Zod schema (schemas are not serializable and
// validation stays on the server).
export interface ConnectableKind {
  kind: string;
  label: string;
  fields: SourceField[];
}

// The fixture's user-entered settings - distinct from the connector's runtime config
// (items / throwAfter, written directly by tests): the wizard captures a display name and
// an optional query as lenient strings, matching what the source list renders today.
const fixtureDef: SourceKindDef = {
  kind: "fixture",
  label: "Fixture (demo)",
  fields: [
    { name: "name", label: "Name", type: "text", placeholder: "e.g. Demo source" },
    { name: "query", label: "Query", type: "text", placeholder: "Optional" },
  ],
  configSchema: z.object({
    name: z.string().trim().default(""),
    query: z.string().trim().default(""),
  }),
};

// LinkedIn jobs (linkedin-jobs-source): the user's search settings. configSchema reuses the
// connector's own schema so the wizard form and the scan-time parse cannot drift.
const linkedinJobsDef: SourceKindDef = {
  kind: "linkedin-jobs",
  label: "LinkedIn jobs",
  fields: [
    { name: "name", label: "Name", type: "text", placeholder: "e.g. Series A eng hiring" },
    {
      name: "keywords",
      label: "Keywords",
      type: "text",
      placeholder: "e.g. VP Engineering",
      required: true,
    },
    { name: "location", label: "Location", type: "text", placeholder: "Optional" },
    {
      name: "postedWithin",
      label: "Posted within",
      type: "text",
      placeholder: "e.g. 7d (optional)",
    },
  ],
  configSchema: linkedinJobsConfigSchema,
};

const catalog = new Map<string, SourceKindDef>([
  [fixtureDef.kind, fixtureDef],
  [linkedinJobsDef.kind, linkedinJobsDef],
]);

export function getSourceKindDef(kind: string): SourceKindDef | undefined {
  return catalog.get(kind);
}

// The kinds offerable in the wizard: declared in the catalog AND backed by a registered
// connector. Zod schema stripped so the result is safe to hand a client component.
export function listConnectableKinds(): ConnectableKind[] {
  return [...catalog.values()]
    .filter((def) => isConnectorRegistered(def.kind))
    .map(({ kind, label, fields }) => ({ kind, label, fields }));
}

// Build a config object from a kind's declared field names (read via the caller's accessor,
// keeping FormData handling out of the lib) and validate it against that kind's schema.
// Throws on an unknown or unregistered kind, or a config the schema rejects, so an unusable
// source configuration is never persisted - including from a direct, non-wizard POST.
export function buildAndValidateConfig(
  kind: string,
  read: (field: string) => string,
): Record<string, unknown> {
  const def = catalog.get(kind);
  if (!def) throw new Error(`unknown source kind "${kind}"`);
  if (!isConnectorRegistered(kind)) {
    throw new Error(`source kind "${kind}" has no registered connector yet`);
  }
  const raw: Record<string, unknown> = {};
  for (const f of def.fields) raw[f.name] = read(f.name);
  return def.configSchema.parse(raw) as Record<string, unknown>;
}
