<!-- deployment marked Skip in the proposal: where-things-run does not change. -->

## Topology

Unchanged. The app and the in-process pg-boss worker run in one Next.js process against one managed Postgres; see docs/architecture/deployment.md (or system-context). The only deployment-relevant invariant this change adds is a CONSTRAINT, not a topology change: pg-boss's `pgboss` schema must reside in the SAME Postgres database as the app's tables for the atomic enqueue-in-transaction guarantee to hold. This is the default (`PGBOSS_DATABASE_URL` falls back to `APP_DATABASE_URL`). Pointing pg-boss at a separate database forfeits atomicity (a cross-database transaction cannot commit atomically) and is unsupported for the atomic handoff (ADR-0009).

## Where each container runs

Unchanged from system-design.md / the existing deployment canon. No container moves.

## Secrets and config

Unchanged. `APP_DATABASE_URL` / `PGBOSS_DATABASE_URL` reach the process via the validated config module (ADR for config / env). The atomic guarantee depends on these resolving to the same database.

## Scaling and multi-tenant hook

Unchanged. This change adds no scaling machinery; the enqueue rides the existing transaction and connection.
