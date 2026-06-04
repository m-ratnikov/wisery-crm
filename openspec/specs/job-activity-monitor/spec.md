# job-activity-monitor Specification

## Purpose

A read-only operations view of the in-process pg-boss pipeline: per-queue counts, the individual waiting jobs, worker liveness (what is running now and the most recent handler failure), and the registered cron schedules, refreshed live without a reload. It exists so the CRM user can tell healthy work from a stuck or failing queue at a glance; it is observability only and never mutates a job or queue.

## Architecture

- Spine and operations surface: the background pipeline in [product-overview.md](../../../docs/product-overview.md); this is an Operations view, not an anchor view.
- Builds on the [background-jobs](../background-jobs/spec.md) capability (the durable pg-boss runtime and facade it introspects).
- Governing decisions: [ADR-0001](../../../docs/adr/0001-background-job-runtime.md) (in-process pg-boss, peel-safety), [ADR-0004](../../../docs/adr/0004-pg-boss-facade.md) (thin pg-boss facade the read-model goes through), [ADR-0011](../../../docs/adr/0011-jobs-monitor-in-process-introspection.md) (the bounded in-process-introspection exception that powers the liveness view).
- Surfaced screen: the wired `/jobs` screen (built directly, no prototype) - see the registry in [src/app/prototype/README.md](../../../src/app/prototype/README.md).
## Requirements
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

### Requirement: Live status without reloading

The job activity shown SHALL refresh automatically on a short interval while the view is open, so the CRM user sees a job progress through its states (queued, active, completed or failed) without manually reloading the page.

#### Scenario: A job advances while the view is open

- **WHEN** the CRM user is watching the jobs monitor and a queued job becomes active and then completes
- **THEN** the view reflects each transition within a few seconds without a manual reload

### Requirement: Surface failed and retrying jobs

A retrying job SHALL be shown with its retry count, and a queue whose worker recorded a recent handler failure SHALL show that failure with its message and the time it occurred, so the CRM user can tell a stuck or failing queue apart from healthy work.

#### Scenario: A job is retrying after an error

- **WHEN** a job handler has thrown and pg-boss has scheduled a retry
- **THEN** the monitor shows that job among the waiting jobs with a retrying state and its current retry count

#### Scenario: A queue's worker recorded a failure

- **WHEN** a job handler has failed
- **THEN** the queue shows its most recent failure with the error message and the time it occurred

### Requirement: View scheduled jobs

The system SHALL show the registered cron-scheduled jobs, each with the queue it targets, its cron expression, and its timezone, so the CRM user can see what recurring work is configured.

#### Scenario: A recurring schedule is registered

- **WHEN** the heartbeat job is scheduled to run every minute
- **THEN** the jobs monitor lists it with its cron expression and timezone

### Requirement: The monitor is read-only

The jobs monitor SHALL be observational only. It SHALL NOT expose controls to cancel, retry, delete, or otherwise mutate jobs or queues in this capability.

#### Scenario: No mutation from the monitor

- **WHEN** the CRM user views the jobs monitor
- **THEN** no action on the page changes any job's state or the contents of any queue

