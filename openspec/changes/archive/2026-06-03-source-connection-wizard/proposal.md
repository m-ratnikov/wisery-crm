## Why

Connecting a signal source today is a flat form: a free-text name, a hardcoded `kind` dropdown, and one generic `query` field, all written into an opaque `{ name, query }` config blob regardless of source type. That does not scale as real connectors land - a LinkedIn jobs source needs keywords, location, and a posted-within window; an X source needs a different shape entirely. There is no per-kind contract for what a source needs configured, no validation that the saved config is usable, and no way to edit a connected source's settings afterward. This change adds a guided wizard and a per-kind settings contract so connecting and tuning a scraper is structured, validated, and self-describing - the framework the upcoming LinkedIn jobs source plugs its settings into.

## What Changes

- Introduce a **source-kind catalog**: each registered source kind declares its connectable settings - a human label, a serializable field descriptor list (so the client wizard can render the right form), and a Zod config schema (so the server validates what gets saved). The catalog is keyed to the connector registry, so a kind appears in the wizard only when its connector is registered (no dead-on-arrival sources).
- Add a **guided connection wizard**: pick a source kind, fill that kind's settings (for example search queries), review, and connect. Replaces the flat "Add a source" form in the source management surface.
- Support **editing a connected source's settings** through the same per-kind form, validated against the kind's schema; persisted as a config update (sources stay retired-by-disable, never deleted).
- Validate `sources.config` against the chosen kind's schema on connect and on edit; a direct POST with a config that does not satisfy the kind's schema is rejected at the boundary (defense in depth, like the existing `isConnectorRegistered` guard).
- No database, migration, pipeline, or job changes: `sources.config` is already connector-shaped JSONB. This change governs what goes into it and how it is entered and validated.

## Capabilities

### New Capabilities
- `source-connection`: connecting and configuring a signal source - the per-kind config-schema catalog (label + field descriptors + Zod schema per registered kind), the guided connection wizard, per-kind config validation on connect and edit, and editing a connected source's settings.

### Modified Capabilities
- `icp-config`: the config screen's source management gains connecting a source through the guided per-kind wizard and editing a connected source's settings, replacing the single flat add-source form (it previously only let the user view, enable/disable, and scan sources).

## Impact

- **New code**: a source-kind catalog module (likely `src/lib/signals/source-kinds.ts`) declaring per-kind `{ label, fields, configSchema }`; the `fixture` kind registers its descriptor there. A server seam that returns the client-safe descriptors (label + fields, no Zod) to the wizard. A wizard client component under the icp-config source surface (multi-step: choose kind, fill settings, review).
- **Modified code**: `src/app/(app)/icp-config/_components/SourcesPanel.tsx` (flat add-form -> wizard entry + per-source edit), `src/app/(app)/icp-config/actions.ts` (`createSourceAction` validates config against the kind schema; a new edit-settings action), `src/lib/signals/sources.ts` (an `updateSourceConfig` write helper alongside `createSource`).
- **Unaffected**: the scan pipeline, the connector contract (`SignalSource.scan`), dedup/persistence, the database schema, all background jobs, and the `/prototype` tree.
- **Dependencies**: none added. Zod, Tailwind, React 19, Next 16 already in use. Sequencing: builds the settings contract that `linkedin-jobs-source` populates (its connector declares its config schema through this catalog).
