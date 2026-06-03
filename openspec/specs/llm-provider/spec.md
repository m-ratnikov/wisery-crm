# llm-provider Specification

## Purpose

The seam for the highest-value calls (qualify, draft): one provider-neutral `LLMProvider` port for data-returning LLM calls. A caller passes a versioned prompt, a Zod schema, and model selection, and receives a schema-valid object plus `{ provider, model, promptVersion }` for eval traceability. Anthropic Structured Outputs is the default adapter; provider-specific optimizations (prompt caching) stay inside the adapter, and a deterministic fake provider makes the port and its consumers testable offline. Swapping the provider is an adapter change, never a pipeline change (D9).

## Architecture

- Decision: [ADR-0003](../../../docs/adr/0003-llm-provider-port.md) (LLMProvider port + provider-neutral structured-output contract); D9 (LLM-agnosticism). The qualifier that consumes it: [product-overview.md](../../../docs/product-overview.md) section 5.
- Container: the LLM provider in [system-design.md](../../../docs/architecture/system-design.md).
- Convention: versioned prompts in `src/prompts/<name>_v<n>.ts` (see `src/prompts/README.md`); structured outputs over `tool_use`, 1h ephemeral cache for large prompts (CLAUDE.md).

## Requirements
### Requirement: Data-returning LLM calls go through one provider-neutral port

The system SHALL make every data-returning LLM call through a single `LLMProvider` port whose contract is provider-neutral: the caller supplies a prompt, the expected result shape as a schema, and model selection, and receives a result that conforms to that schema. Selecting or swapping the underlying provider SHALL NOT change the calling code, so a vendor change is an adapter swap rather than a pipeline change.

#### Scenario: A caller receives a schema-valid object

- **WHEN** a caller invokes the port with a prompt and an expected result schema
- **THEN** it receives an object that conforms to that schema, without referencing any provider-specific request or response shape

#### Scenario: Swapping the provider leaves callers unchanged

- **WHEN** the configured default provider is changed to a different adapter
- **THEN** the same calling code returns a result conforming to the same schema, with no change to the call site

### Requirement: Results are validated and failures are typed

The system SHALL validate every LLM result against the caller's schema before returning it, so a caller never receives a partially-parsed or schema-invalid object. A call that cannot produce a schema-valid result SHALL surface a typed failure that distinguishes a result-validation failure from a provider or transport failure.

#### Scenario: An invalid result is rejected, not returned

- **WHEN** the provider returns content that does not satisfy the caller's schema
- **THEN** the call surfaces a validation failure
- **AND** no partially-parsed or schema-invalid object is returned to the caller

#### Scenario: A provider failure is distinguishable from a validation failure

- **WHEN** the underlying provider call fails (transport, auth, or provider error)
- **THEN** the caller can tell that failure apart from a result that arrived but failed schema validation

### Requirement: Every call is traceable for evaluation

The system SHALL record, with each data-returning LLM call, the prompt version used and the provider and model that served it, so results can be evaluated and compared per prompt version and per provider+model over time. Prompts SHALL be versioned artifacts, and a prompt's recorded version SHALL identify exactly which prompt text produced a result.

#### Scenario: A result carries its prompt version, provider, and model

- **WHEN** a data-returning call completes
- **THEN** the prompt version, provider, and model that produced it are available alongside the result

#### Scenario: Editing a prompt is a new version

- **WHEN** a prompt's text is changed
- **THEN** it is published as a new version rather than mutating the recorded text of the existing version, so a past result's prompt version still identifies the text that produced it

### Requirement: Provider-specific optimizations stay inside the adapter

The system SHALL confine provider-specific, non-portable optimizations to the adapter that needs them and keep them out of the port contract, so that no caller depends on a feature one provider has and another lacks. On the default Anthropic adapter, prompt caching SHALL be applied within the adapter for large prompts.

#### Scenario: A caller does not configure provider-specific features

- **WHEN** a caller makes a data-returning call
- **THEN** it does not set or depend on any provider-specific optimization (such as a particular provider's prompt-caching controls); such optimizations are applied inside the adapter

### Requirement: The port is testable offline

The system SHALL provide a deterministic provider implementation that returns schema-valid results with no network access and no API key, so the port and its consumers can be tested end to end offline.

#### Scenario: Tests run without a network or API key

- **WHEN** a consumer of the port is exercised under test with the deterministic provider selected
- **THEN** the calls return schema-valid results without any network request or API key

