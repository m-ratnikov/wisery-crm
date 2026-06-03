# qualification Specification

## Purpose

The cost gate and noise cut: a persisted Signal fans out to person Prospect(s) (one-to-many, ADR-0005), each scored 1-5 (or -1 insufficient-data) against the active ICP rubric through the LLM port, gated at >= 3. Below-bar prospects are retained, not surfaced. Every score is recorded per prospect with its rubric, prompt, provider, and model versions so outcomes bind to the exact score a prospect was acted on (D7). Newly persisted signals are queued for qualification automatically.

## Architecture

- Decisions: [product-overview.md](../../../docs/product-overview.md) sections 4-5 (the pipeline, the ported scorer D5), [ADR-0005](../../../docs/adr/0005-signal-to-prospect-fan-out.md) (one-to-many fan-out, score per prospect), [ADR-0003](../../../docs/adr/0003-llm-provider-port.md) (LLM via the port, structured output), D6 (rubric config-as-data), D7 (score recorded with versions).
- Data model: `Prospect` / `Scoring` and the lifecycle + `ProspectScored`/`ProspectQualified` events in [domain-model.md](../../../docs/architecture/domain-model.md).
- Reuses the `LLMProvider` port (`src/lib/llm`, fake provider injected in tests), the ICP config-as-data (`src/lib/icp`, `getActiveRubric`), and `signal-ingestion`'s scan worker - the enqueue-on-persist hook is wired at the composition root so signal-ingestion never imports qualification. Surfaced (read-only) in the prospect-list and review-queue anchor views; see the [prototype registry](../../../src/app/prototype/README.md).
- Idempotency mechanism: there is deliberately NO DB uniqueness constraint on a signal's prospects (that would break the ADR-0005 one-to-many fan-out). The "at most one prospect/scoring per signal even concurrently" guarantee is enforced at the queue layer - the `qualify` pg-boss queue uses `policy: "singleton"` keyed on the signal id, so two concurrent qualify runs for one signal cannot execute at once - paired with a has-prospect-for-signal guard in the pipeline. Note: that guard short-circuits on the FIRST prospect, which is correct for M1's person-source N=1 fan-out; the N>1 company/content expansion (normalize-expand, M2) must replace it with an expansion-keyed guard so it does not swallow the additional prospects.
## Requirements
### Requirement: A signal fans out to person prospects

The system SHALL turn a persisted Signal into the person prospect(s) worth evaluating: a person-yielding signal produces exactly one prospect, and the signal-to-prospect relationship SHALL be one-to-many so a single signal can later expand into many prospects without a schema change. Each prospect SHALL reference the signal it came from, and the score SHALL be recorded against the prospect, never on the shared signal.

#### Scenario: A person signal yields one prospect

- **WHEN** a person signal is qualified
- **THEN** exactly one prospect is created referencing that signal

#### Scenario: The score is a property of the prospect

- **WHEN** a prospect is scored
- **THEN** the score is recorded against that prospect, and the signal carries no score

### Requirement: Each prospect is scored 1-5 against the active rubric

The system SHALL score each prospect from 1 to 5 against the active ICP rubric read as configuration, recording a reason and summary. The rubric SHALL be read as config-as-data, never hardcoded. When the available data is too thin to judge responsibly, the system SHALL record an insufficient-data result (a score of -1) rather than guess.

#### Scenario: A prospect is scored against the active rubric

- **WHEN** a prospect is qualified and an active rubric exists
- **THEN** a score from 1 to 5 is recorded for it with a reason and a summary, judged against the active rubric's criteria

#### Scenario: Thin data yields insufficient-data, not a guess

- **WHEN** a prospect's signal is too thin to judge responsibly
- **THEN** an insufficient-data result (score -1) is recorded rather than a fabricated score

### Requirement: The score gate decides what flows downstream

The system SHALL gate prospects on their latest score against the active rubric: a score of 3 or higher qualifies the prospect for downstream processing, and a score below 3 (or insufficient-data) marks the prospect below-bar. Below-bar prospects SHALL be retained, not deleted, so the learning loop can use them later, but SHALL NOT be surfaced as actionable.

#### Scenario: A 3-or-higher score qualifies the prospect

- **WHEN** a prospect scores 3 or higher
- **THEN** it is marked qualified and eligible for downstream processing

#### Scenario: A below-bar score is retained but not surfaced

- **WHEN** a prospect scores below 3 or insufficient-data
- **THEN** it is marked below-bar and retained, and is not surfaced as an actionable prospect

### Requirement: Every score is recorded for outcome-bound learning

The system SHALL record, with each score, the rubric version, the prompt version, and the model that produced it, so that a later outcome can bind to the exact score and rubric a prospect was acted on. Scoring SHALL be additive: re-scoring a prospect records a new scoring rather than overwriting the prior one.

#### Scenario: A score carries its rubric, prompt, and model versions

- **WHEN** a prospect is scored
- **THEN** the recorded score includes the rubric version, prompt version, and model used

#### Scenario: Re-scoring is additive

- **WHEN** a prospect is scored again
- **THEN** a new scoring is recorded and the previous scoring is retained

### Requirement: A newly persisted signal is queued for qualification

The system SHALL enqueue qualification for each newly persisted Signal, so a scan that lands new signals leads to those signals being scored without a manual step. A signal that was already persisted (a re-scan duplicate) SHALL NOT be re-qualified, so re-scanning a source does not re-score existing prospects.

#### Scenario: New signals are qualified after a scan

- **WHEN** a scan persists new signals
- **THEN** qualification is enqueued for each newly persisted signal

#### Scenario: Re-scan does not re-qualify

- **WHEN** a re-scan produces only duplicate signals that were already persisted
- **THEN** no new qualification work is enqueued for them

### Requirement: Qualification is idempotent under duplicate or concurrent processing

The system SHALL produce at most one prospect and one scoring per signal even when qualification for that signal is requested more than once, including concurrently. Duplicate or overlapping qualification work for the same signal SHALL NOT create a second prospect lineage or incur a second scoring of that signal. This idempotency SHALL hold without a uniqueness constraint on a signal's prospects, so the one-to-many fan-out (a future company or content signal expanding into many prospects) is preserved.

#### Scenario: A signal qualified twice yields a single prospect

- **WHEN** qualification runs for the same signal more than once
- **THEN** exactly one prospect and one scoring exist for that signal, and the duplicate run is a no-op

#### Scenario: Concurrent qualification of one signal does not double it

- **WHEN** two qualification attempts for the same signal overlap
- **THEN** only one prospect and one scoring are created for that signal

