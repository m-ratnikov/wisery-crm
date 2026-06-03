## Why

The two highest-value steps in the pipeline (qualify and draft) are LLM calls, but there is no seam for them yet: the data layer landed with `signal-ingestion`, and `qualification`/`drafting` are next and both need a way to make a data-returning LLM call. D9 locks LLM-agnosticism and ADR-0003 specifies the realization - an `LLMProvider` port with a provider-neutral, Zod-validated structured-output contract and Anthropic as the default adapter. Building this now means qualify and draft plug into a stable port rather than coding straight to one vendor's SDK.

## What Changes

- **The `LLMProvider` port**: a single interface for a data-returning LLM call. The caller passes a versioned prompt, a Zod schema describing the expected result, and model selection; the provider returns a schema-valid object plus call metadata (`provider`, `model`, `promptVersion`) for eval traceability (ADR-0003, D9).
- **The Anthropic default adapter**: maps the contract onto Anthropic Structured Outputs via the SDK's `zodOutputFormat` helper (transform-on-by-default in `@anthropic-ai/sdk` 0.97.0, which strips unsupported JSON-Schema keywords to a valid wire subset and validates the response locally - the two-layer split is the SDK's behavior, not hand-rolled). Provider-specific optimizations that are not portable - Anthropic prompt caching via `cache_control` ephemeral `ttl: "1h"` for prompts over 1024 tokens - live inside this adapter, never in the port contract (ADR-0003, CLAUDE.md).
- **Versioned prompt convention**: prompts live in `src/prompts/<name>_v<n>.ts`; each call records its `promptVersion` alongside provider and model id.
- **A deterministic in-repo fake provider** ships with the change so the port is unit-testable end to end with no network and no API key, and so downstream capabilities (`qualification`, `drafting`) can be tested against the port without calling Anthropic.
- **Error contract**: a data-returning call yields a schema-valid object or a typed error (validation failure vs provider/transport failure), never a partially-parsed or schema-invalid result.

Not in scope: any concrete prompt for qualify or draft (owned by those capabilities); a non-Anthropic adapter (the port is provider-neutral from day one, but only the Anthropic default and the test fake ship here - ADR-0003's no-native-mode fallback path is built when a provider that needs it is added); streaming or multi-turn chat (the contract is single-shot, data-returning); any database table (this capability persists nothing - callers persist results).

## Capabilities

### New Capabilities
- `llm-provider`: data-returning LLM access through one provider-neutral, Zod-validated structured-output port; versioned prompts with recorded prompt-version/provider/model for eval traceability; the Anthropic Structured Outputs adapter as the default, with provider-specific optimizations (prompt caching) confined to the adapter; a deterministic fake provider for offline testing.

### Modified Capabilities
<!-- None. This change adds a new port and adapter; it reuses platform-runtime (config) and code-quality (verify gate) without altering their contracts. signal-ingestion, background-jobs, and platform-runtime requirements are unchanged. -->

## Impact

- **New code**: `src/lib/llm/` - the `LLMProvider` port + contract types, the Anthropic adapter, the in-repo fake provider, and a provider accessor (`getLLM()`) selecting the default adapter from config; the first prompt-versioning convention under `src/prompts/`.
- **Config**: `ANTHROPIC_API_KEY` already exists in `src/lib/config/env` (optional) and `.env.example`; this change reads it through `src/lib/config/env` and fails clearly if the Anthropic adapter is used without it. No new env var expected.
- **Reused seams** (no parallel mechanisms): config via `src/lib/config/env`, logging via `src/lib/log`; `server-only` on every module so no adapter or key reaches the client bundle. No `src/lib/db` or jobs dependency (the port is stateless; callers own persistence and enqueuing).
- **Architectural boundary**: a dependency-cruiser rule (the engineering.md port/adapter extension point, as `signal-ingestion` did for connectors) so the port and callers never import a concrete adapter directly - adapters are reached only through the provider accessor.
- **Dependencies**: `@anthropic-ai/sdk` 0.97.0 (already installed); `zod` (already installed).
- **Governed by**: ADR-0003 (LLMProvider port + native structured output), D9 (LLM-agnosticism), CLAUDE.md (Structured Outputs not tool_use; prompt versioning; 1h cache). Architecture home: `docs/architecture/system-design.md` (the LLM provider container) and `docs/product-overview.md` section 5 (the qualifier).
