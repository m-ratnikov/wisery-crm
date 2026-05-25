## ADDED Requirements

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
