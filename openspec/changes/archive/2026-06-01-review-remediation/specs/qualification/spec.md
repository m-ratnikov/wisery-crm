## ADDED Requirements

### Requirement: Qualification is idempotent under duplicate or concurrent processing

The system SHALL produce at most one prospect and one scoring per signal even when qualification for that signal is requested more than once, including concurrently. Duplicate or overlapping qualification work for the same signal SHALL NOT create a second prospect lineage or incur a second scoring of that signal. This idempotency SHALL hold without a uniqueness constraint on a signal's prospects, so the one-to-many fan-out (a future company or content signal expanding into many prospects) is preserved.

#### Scenario: A signal qualified twice yields a single prospect

- **WHEN** qualification runs for the same signal more than once
- **THEN** exactly one prospect and one scoring exist for that signal, and the duplicate run is a no-op

#### Scenario: Concurrent qualification of one signal does not double it

- **WHEN** two qualification attempts for the same signal overlap
- **THEN** only one prospect and one scoring are created for that signal
