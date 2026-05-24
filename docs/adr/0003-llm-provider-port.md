# ADR-0003: LLM access goes through an LLMProvider port with a provider-neutral structured-output contract

- Status: accepted
- Date: 2026-05-23 (accepted + promoted 2026-05-24)
- Supersedes: none
- Source: openspec/changes/c4-level2-architecture/system-design.md (Decisions - "LLM-agnostic via an LLMProvider port") and the C4 L2 review follow-up (the LLM box was named for one vendor).

## Context

The qualify and draft steps are the highest-judgment, highest-value calls in the system, and they are LLM calls. The L2 container view first drew that boundary as "LLM API - Anthropic," which binds the most valuable path to a single vendor's SDK and API.

CLAUDE.md currently mandates "Anthropic Structured Outputs over `tool_use` for any LLM call returning data," plus the `@anthropic-ai/sdk` and Anthropic-specific prompt caching (`cache_control` with a `ttl`). Structured Outputs is an Anthropic-specific mechanism; other providers expose their own structured-output modes with different shapes, and some have none.

D4 already establishes the port/adapter pattern for `SignalSource` and `EnrichmentProvider` (interchangeable adapters behind a stable interface). The qualify/draft path lacked the equivalent seam, so a vendor change would be a code change in the pipeline rather than an adapter swap.

LLM-agnosticism is a **locked product decision (D9)**; this ADR is its architectural realization. (CLAUDE.md was updated on 2026-05-23 to route LLM calls through the `LLMProvider` port and use each provider's native structured-output mode, so canon and this ADR agree.)

## Decision

All LLM calls go through an **`LLMProvider` port**. Any data-returning call is specified as a **provider-neutral JSON Schema** and its result is validated with **Zod** at the boundary - this schema is the common-ground contract that every adapter must satisfy.

Each adapter maps the shared contract onto its provider's **native structured-output mode**: for Anthropic that is **Anthropic Structured Outputs** (`output_config.format`, GA January 2026, public beta November 2025; not `tool_use`; verified against installed `@anthropic-ai/sdk` 0.97.0); for a provider with a JSON-schema response mode, that mode. Where a provider has no native structured-output mode, its adapter falls back to constrained prompting plus Zod validate-and-repair, so callers always receive a schema-valid object regardless of provider.

**Anthropic remains the default adapter.** Prompts stay versioned (`src/prompts/<name>_v<n>.ts`), and each call records `prompt_version` alongside the provider and model id for eval traceability. Provider-specific optimizations that are not portable (e.g. Anthropic prompt caching via `cache_control`) live **inside that adapter**, not in the port contract.

## Consequences

- **The wire schema must be a supported subset - but on the default adapter the SDK handles this.** Anthropic's native structured-output mode rejects common JSON-Schema keywords that idiomatic Zod emits (numeric/length bounds like `minimum`/`maximum`/`minLength`, arbitrary `minItems`, recursion, `additionalProperties` other than `false`, advanced regex) and caps schema complexity (tool/param/union limits, 180s compile). On the default Anthropic adapter, the SDK's `zodOutputFormat` / `jsonSchemaOutputFormat` helpers (transform on by default, verified in `@anthropic-ai/sdk` 0.97.0 `lib/transform-json-schema.js`) already strip the unsupported keywords to a valid wire subset and validate the response against the original Zod schema locally - so the **two-layer split** (structural subset on the wire, full Zod after parse) is the SDK's behavior, not hand-rolled. The 400 risk is real only on the raw `messages.create` path (a hand-built `output_config.format.schema`, unvalidated client-side) and for non-Anthropic adapters lacking an equivalent transform; cross-field/semantic rules no provider schema can express still go in a Zod `.refine`/`.superRefine`. Accepted.
- CLAUDE.md was updated (2026-05-23) to "LLM calls go through the `LLMProvider` port; use the provider's native structured-output mode, never `tool_use`; for the default Anthropic adapter that is Anthropic Structured Outputs," and D9 locks LLM-agnosticism - so this ADR **aligns with canon rather than overriding it** (the earlier split between a proposed ADR and the CLAUDE.md rule is closed).
- Output fidelity, latency, and cost vary by adapter, so evals must be run per provider+model, and the D7 qualify threshold (score >= 3) may need per-model calibration.
- Swapping or adding a provider is an adapter change, not a pipeline change - consistent with the D4/D8 adapter discipline.
- PII is carried to whichever provider is selected, so the data-processor / sub-processor surface now spans multiple possible vendors. Field minimization attaches at the qualify boundary (D10).
- A provider-neutral contract is slightly more work than coding straight to one SDK (a schema-translation layer per adapter, and the no-native-mode fallback path), accepted as the cost of agnosticism.
