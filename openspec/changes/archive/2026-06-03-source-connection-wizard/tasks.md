## 1. Source-kind catalog (the settings contract)

- [x] 1.1 Add `src/lib/signals/source-kinds.ts`: the `SourceField` / `SourceKindDef` types and a `Map<kind, SourceKindDef>` catalog. Register the `fixture` kind with label "Fixture (demo)", fields `[name, query]`, and `configSchema: z.object({ name: z.string()..., query: z.string()... })` matching today's fixture config so the existing flow is preserved.
- [x] 1.2 Add `listConnectableKinds(): { kind; label; fields }[]` returning only kinds whose connector is registered (`isConnectorRegistered`), with the Zod schema stripped (client-safe descriptors only).
- [x] 1.3 Add a `buildAndValidateConfig(kind, formValues)` helper that builds a config object from the kind's declared field names and validates it with that kind's `configSchema`, throwing on an unknown/unregistered kind or invalid config.

## 2. Source write seam

- [x] 2.1 Add `updateSourceConfig(id, config)` to `src/lib/signals/sources.ts` beside `createSource` (in-place config update; the source keeps its id and history, retire-by-disable preserved).

## 3. Server actions (generalized, validated)

- [x] 3.1 Generalize `createSourceAction` in `src/app/(app)/icp-config/actions.ts`: read `kind`, reject if not registered/in catalog, `buildAndValidateConfig`, then `createSource`; reuse the existing `field()` helper. Reject invalid config and unregistered kinds (defense in depth for direct POST).
- [x] 3.2 Add `updateSourceSettingsAction`: read `id` + `kind`, `buildAndValidateConfig`, then `updateSourceConfig`; revalidate `/icp-config`.

## 4. Guided wizard UI

- [x] 4.1 Add a `'use client'` wizard component under `src/app/(app)/icp-config/_components/` (multi-step local state: choose kind -> fill that kind's fields -> review/connect), rendering inputs from the `fields` descriptors passed in from the Server Component page.
- [x] 4.2 Wire the page (`icp-config/page.tsx`) to pass `listConnectableKinds()` into the source panel; replace the flat add-source form in `SourcesPanel.tsx` with the wizard entry.
- [x] 4.3 Add per-source "Edit settings" affordance that renders the kind's fields prefilled from the source's current config and submits `updateSourceSettingsAction`.

## 5. Tests and verification

- [x] 5.1 Unit test `source-kinds.ts`: every registered connector kind has a catalog entry; each kind's `configSchema` accepts a config built from its own declared fields (descriptor/schema drift guard); `buildAndValidateConfig` rejects invalid config and unregistered kinds; `listConnectableKinds` excludes unregistered kinds and omits the Zod schema.
- [x] 5.2 Test the fixture connect path end to end through `buildAndValidateConfig` -> `createSource` (config persists as `{ name, query }`, still valid under the fixture schema).
- [x] 5.3 `npm run verify` green (typecheck, lint, format, dependency-cruiser, jscpd, per-file coverage, build).
- [x] 5.4 `code-review` pass on the change surface (loop: re-verify and re-review the fix delta until a pass finds nothing material) before archive.
