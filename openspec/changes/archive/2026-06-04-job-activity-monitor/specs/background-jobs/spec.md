## ADDED Requirements

### Requirement: Job activity introspection

The jobs facade SHALL expose a read-model of background-job activity so callers can observe the queue without reaching the raw pg-boss instance or reading the `pgboss` schema tables directly. The read-model SHALL cover, per queue, the active / queued / deferred counts and the individual in-flight jobs (state, start time, liveness, retry count, and failure output), and separately the registered cron schedules. It SHALL be read-only - introspection never enqueues, mutates, or removes a job.

#### Scenario: Reading queue activity

- **WHEN** a caller requests job activity through the facade
- **THEN** it receives each known queue with its active, queued, and deferred counts
- **AND** the in-flight jobs for those queues, each with its state, start time, liveness, and retry count

#### Scenario: Reading schedules

- **WHEN** a caller requests the registered schedules through the facade
- **THEN** it receives each cron schedule with its target queue, cron expression, and timezone

#### Scenario: Introspection does not bypass the facade

- **WHEN** the monitor reads job activity
- **THEN** it does so through the jobs facade read-model
- **AND** not by querying the `pgboss` schema tables or holding the raw pg-boss instance
