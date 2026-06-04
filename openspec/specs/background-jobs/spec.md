## Purpose

Durable background work on Postgres via an in-process pg-boss worker, reached through a thin facade: enqueue and process, retries with a dead-letter path, cron scheduling, and graceful drain on shutdown.
## Requirements
### Requirement: Durable job enqueue and processing
The system SHALL run background work as durable pg-boss jobs on Postgres, in-process (no Redis and no separate worker process by default), reached through the jobs facade rather than the raw pg-boss instance.

#### Scenario: Enqueue and process
- **WHEN** code enqueues a job through the facade and a handler is registered for that job
- **THEN** the handler runs and the job completes
- **AND** the job and its state persist in Postgres (the `pgboss` schema)

### Requirement: Retries and a dead-letter path
A failing job SHALL be retried, and SHALL move to a dead-letter path after retries are exhausted, without crashing the worker or affecting other jobs.

#### Scenario: A handler throws
- **WHEN** a job handler throws
- **THEN** pg-boss retries the job per its retry policy
- **AND** after retries are exhausted the job is dead-lettered
- **AND** the worker process and other jobs are unaffected

### Requirement: Cron scheduling
The system SHALL support cron-scheduled jobs registered at startup, running in the in-process worker.

#### Scenario: Scheduled tick
- **WHEN** a cron job is registered at boot
- **THEN** it fires on its schedule in the in-process worker
- **AND** each run is logged

### Requirement: Graceful drain on shutdown
On shutdown the job runtime SHALL stop gracefully, and because a restart re-runs in-flight jobs, externally-billed steps SHALL be idempotent.

#### Scenario: Shutdown during an in-flight job
- **WHEN** the process is asked to stop while a job is in flight
- **THEN** the runtime calls graceful stop
- **AND** on restart the in-flight job may re-run, which is safe because handlers are idempotent

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

