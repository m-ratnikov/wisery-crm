## MODIFIED Requirements

### Requirement: View running and queued background jobs

The system SHALL present a view of current background-job activity. For each pg-boss queue it SHALL show how many jobs are active, queued, and deferred. It SHALL surface currently running work as the queue's active count together with a worker liveness indication - how many jobs are in flight and when the running work started. It SHALL list the individual WAITING jobs (created and retrying) with their state and the time they were enqueued. Active jobs are surfaced through the running indicator and liveness, not as per-job rows, in this read-only slice.

The displayed queue set SHALL be limited to application queues. pg-boss internal queues (those the engine maintains for its own scheduling and timekeeping, identifiable by the reserved `__pgboss__` name prefix) SHALL NOT appear in the user-facing queue list, because they are engine machinery rather than the user's background work. Excluding them from display SHALL NOT change how liveness is collected internally.

#### Scenario: A queue has work in flight

- **WHEN** the CRM user opens the jobs monitor while a source-scan job is running
- **THEN** the `source-scan` queue is shown with a non-zero active count
- **AND** a liveness indication shows work is in flight and when the running work started

#### Scenario: Jobs are waiting to run

- **WHEN** jobs are enqueued and waiting (created or retrying)
- **THEN** each waiting job is listed with its state and the time it was enqueued

#### Scenario: Queues are idle

- **WHEN** the CRM user opens the jobs monitor and no jobs are in flight
- **THEN** each queue is shown with zero active and zero queued counts
- **AND** the view indicates there is no work currently in flight rather than appearing broken

#### Scenario: Internal pg-boss queues are not shown

- **WHEN** the CRM user opens the jobs monitor and the engine maintains its own internal queue (for example a timekeeping queue named with the `__pgboss__` prefix)
- **THEN** that internal queue is not listed among the application queues
- **AND** only the application's own queues (such as `source-scan`, `qualify`, `enrich`, `draft`, and `heartbeat`) are shown
