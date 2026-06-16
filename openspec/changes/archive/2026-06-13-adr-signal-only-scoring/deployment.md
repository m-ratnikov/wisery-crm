## Deployment

Skipped per the proposal: where-things-run is unchanged (single Node process with in-process pg-boss, managed Postgres - ADR-0001/0004). No worker, queue, or topology change is involved; the qualify queues were already retired and cleaned up by ADR-0019's promotion.

The only operational artifact is one destructive forward-only Drizzle migration (DROP TABLE `scorings`; ALTER TABLE `outcomes` DROP COLUMN `score_at_time`), owned and sequenced by the companion code change `remove-person-scoring` (its tasks.md). Rollback is a dev-snapshot restore; accepted pre-launch.
