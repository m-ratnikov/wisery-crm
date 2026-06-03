<!-- Skip per the proposal: where-things-run is not in this change's scope. -->

## Topology

Out of scope for this change. Deployment topology is unchanged from canon: one Node process running both the web and in-process pg-boss worker roles, plus managed Postgres (ADR-0001). This change shapes the data model and the in-process component decomposition, not where containers run.

## Where each container runs

Unchanged. No container is added, removed, or relocated by this change. The C4 L3 components introduced in system-design.md all live inside the single existing app container.

## Secrets and config

Unchanged (ADR-0001 / cross-cutting.md). No new secret or runtime-config surface is introduced by a modeling-only change.

## Scaling and multi-tenant hook

The conceptual hook stays in system-design.md cross-cutting and product-overview section 7: add `tenant_id` to the config-as-data entities with row-level security, or a schema/database per tenant on the same Postgres cluster. This change keeps that hook a single, additive seam by concentrating per-tenant data in the config-as-data entities (Source, Rubric, User Profile). No infrastructure realization is decided here.
