### Requirement: Configuration is validated at startup
The system SHALL validate all required environment configuration at process startup and SHALL refuse to start if any required value is missing or malformed.

#### Scenario: Missing required configuration
- **WHEN** the process starts without a required variable (e.g. the app database URL)
- **THEN** startup fails fast with an error naming the missing or invalid variable
- **AND** no database connection or job worker is started

#### Scenario: Valid configuration
- **WHEN** the process starts with all required variables present and valid
- **THEN** a typed, validated config object is available to the rest of the app
- **AND** application modules read configuration from that object, not from `process.env` directly

### Requirement: Application connects to Postgres over a pooled connection
The system SHALL connect to Postgres for application queries through a pooled connection managed by Drizzle on node-postgres, separate from the background-job connection.

#### Scenario: Query round-trip
- **WHEN** the app issues a query through the Drizzle client
- **THEN** it executes against Postgres and returns a result
- **AND** the pool's size is bounded by an explicit maximum

### Requirement: Structured logging
The system SHALL emit structured (JSON) logs via pino and SHALL NOT log secrets such as API keys or connection strings.

#### Scenario: A structured event is logged
- **WHEN** the app logs an event
- **THEN** the output is structured with at least a level and a timestamp
- **AND** configured secret fields are redacted

### Requirement: Graceful shutdown
The system SHALL, on SIGTERM or SIGINT, attempt to drain in-flight background work before exit.

#### Scenario: Termination signal received
- **WHEN** the process receives SIGTERM
- **THEN** it calls the job runtime's graceful stop within the host stop window
- **AND** because drain is best-effort, in-flight externally-billed work is idempotent so a re-run on restart is safe
