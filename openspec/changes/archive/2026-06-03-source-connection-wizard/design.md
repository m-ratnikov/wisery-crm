## Context

Source creation today (`createSourceAction` in `icp-config/actions.ts`) reads a free-text `name`, a `kind` from a hardcoded `<select>`, and one `query`, and writes `config: { name, query }` for every kind. The `SignalSource` port is `{ kind, scan() }` - it says nothing about what a kind needs configured. The connector registry (`src/lib/signals/registry.ts`) is the single `kind -> connector` wiring point and exposes `isConnectorRegistered(kind)`; `createSourceAction` already rejects unregistered kinds. `sources.config` is opaque `Record<string, unknown>` JSONB. Source write helpers live in `src/lib/signals/sources.ts` (`createSource`, `setSourceEnabled`).

This change makes each kind self-describing about its settings, and turns the flat form into a guided, validated, per-kind wizard. It is the settings contract `linkedin-jobs-source` will populate.

## Goals / Non-Goals

**Goals:**
- A per-kind settings contract: label, renderable field descriptors, and a Zod validation schema, declared in one place per kind.
- A guided wizard (choose kind, fill that kind's settings, confirm) that renders from the descriptors and validates on the server.
- Editing a connected source's settings in place (no delete/recreate), same validation.
- Only kinds with a registered connector are offered.

**Non-Goals:**
- No change to the `SignalSource.scan` contract, the scan pipeline, dedup/persistence, or any job.
- No database or migration change (`sources.config` is already JSONB).
- No real connector lands here (`fixture` is the only registered kind); LinkedIn jobs arrives in `linkedin-jobs-source`.
- No scheduling UI (the `schedule` column stays reserved).

## Decisions

### D1. A source-kind catalog separate from the scan port

Add `src/lib/signals/source-kinds.ts` declaring, per kind, a `SourceKindDef`:

```
type SourceFieldType = "text" | "textarea";
interface SourceField { name: string; label: string; type: SourceFieldType; placeholder?: string; required?: boolean }
interface SourceKindDef { kind: string; label: string; fields: SourceField[]; configSchema: z.ZodType }
```

A catalog `Map<kind, SourceKindDef>` holds them; `fixture` registers `{ label: "Fixture (demo)", fields: [name, query], configSchema: z.object({ name, query }) }` so today's behavior is preserved.

- **Why not put `label`/`fields`/`configSchema` on the `SignalSource` port**: the port is the scan contract (role-agnostic, worker-side). Config-entry descriptors are a web/config concern. Bolting them onto the scan port mixes concerns and forces every connector to carry UI metadata. Keeping a separate catalog joined by the `kind` string keeps the scan port minimal and lets the config contract evolve independently.
- **Why a separate catalog and not the registry**: the registry is server-only and imports concrete connectors (the DIP wiring point enforced by dependency-cruiser). The catalog is data (descriptors + schemas), consumed by the web surface. They are joined by `kind`; the wizard offers `catalog kinds ∩ isConnectorRegistered`.
- **Sync risk** between catalog and registry -> a unit test asserts every registered connector kind has a catalog entry and every catalog entry's `configSchema` accepts a config built from its own declared fields (so descriptors and schema cannot silently drift). See D4.

### D2. Client wizard renders from serializable descriptors; server owns Zod

A Zod schema is not serializable to a client component. Expose a server helper `listConnectableKinds(): { kind, label, fields }[]` (descriptors only, no schema) that the icp-config page (Server Component) passes to the wizard client component. The wizard renders inputs from `fields` and posts to a Server Action; the action looks the kind up in the catalog and validates the submitted config with that kind's `configSchema`. So the schema never crosses to the client, and validation is server-authoritative (a direct POST is validated identically).

### D3. Wizard is an inline multi-step panel in the source surface; actions stay form-based

The wizard is a `'use client'` component inside the icp-config source panel (reason: multi-step local state - chosen kind, draft field values - before a single confirming submit). Steps: choose kind -> fill that kind's fields -> review and connect. It submits a Server Action (`createSourceAction`, generalized). Editing reuses the same field-rendering against an existing source's config via an `updateSourceSettingsAction`.

- **Why inline, not a new route**: the spec keeps source management on the config screen; an inline panel avoids a route and keeps the flow where sources already live. A dedicated `/sources/new` route is a later option if the surface grows.
- `createSourceAction` is generalized: read `kind`, reject if not in catalog or not registered, build the config object from the kind's declared field names in `FormData`, `configSchema.parse(...)`, then `createSource`. `updateSourceSettingsAction`: same build+parse, then `updateSourceConfig(id, config)`.

### D4. New write helper and tests on the pure logic

Add `updateSourceConfig(id, config)` to `src/lib/signals/sources.ts` beside `createSource` (the existing source write seam). The catalog logic (`listConnectableKinds`, a `buildConfig(kind, formValues)` + validate helper, the catalog/registry sync) lives under `src/lib/signals` and is coverage-included, so it gets unit tests; the wizard component and actions are under `src/app/**` (coverage-excluded, like the other wired UI).

## Risks / Trade-offs

- **Catalog/registry drift** (a kind in one but not the other) -> the D4 sync test fails the build if a registered connector lacks a catalog entry; the wizard intersects the two so a catalog-only kind is simply never offered.
- **Descriptor/schema drift** (a field declared but not in the schema, or vice versa) -> the D4 test builds a config from the declared fields and asserts the schema accepts it, catching the common drift; richer per-field constraints still live in the schema.
- **Generalizing `createSourceAction` could regress the fixture path** -> the fixture kind keeps its `{ name, query }` schema, so the existing fixture flow is preserved; an integration/unit test covers connect-fixture.
- **`FormData` field reading** reuses the existing `field()` helper pattern in `actions.ts` (guards `File` values), so the generalized action stays on-pattern.

## Migration Plan

No data migration. Pure additive code plus a generalized action and a UI swap. Rollback is a git revert; no persisted shape changes (existing fixture sources already carry `{ name, query }`, which remains valid under the fixture schema).
