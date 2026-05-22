# Parked schema - DISABLED

This schema is intentionally disabled. Its manifest is renamed `schema.yaml.disabled`
so the OpenSpec CLI does not discover it (discovery keys on `schema.yaml`), which means
it cannot be selected as the project default or via `--schema spec-driven-with-adr`.

Why: ADRs are now owned solely by `spec-driven-architecture`. The project default reverted
to the built-in `spec-driven` on 2026-05-21. See `openspec/config.yaml` and the explore note
`docs/explore/2026-05-21-architecture-folder-organization.md` for the reasoning.

To re-enable: rename `schema.yaml.disabled` back to `schema.yaml`. It will reappear in
`openspec schemas`. Nothing else references it.
