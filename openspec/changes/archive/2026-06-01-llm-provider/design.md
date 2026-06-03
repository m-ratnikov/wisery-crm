## Context

The data layer landed with `signal-ingestion`; the next two capabilities (`qualification`, `drafting`) are LLM calls and need a seam. D9 locks LLM-agnosticism and ADR-0003 specifies the realization: an `LLMProvider` port with a provider-neutral, Zod-validated structured-output contract, Anthropic as the default adapter, versioned prompts, and provider-specific optimizations confined to the adapter. The Anthropic SDK is already installed (`@anthropic-ai/sdk` 0.97.0); `ANTHROPIC_API_KEY` already exists as an optional var in `src/lib/config/env` and `.env.example`.

This change builds the port, the Anthropic default adapter, the prompt-versioning convention, and a deterministic fake provider for offline testing. It persists nothing and enqueues nothing - callers own that.

## Goals / Non-Goals

**Goals:**
- One `LLMProvider` port for data-returning calls: caller passes a versioned prompt, a Zod schema, and model selection; receives a schema-valid object plus `{ provider, model, promptVersion }`.
- The Anthropic default adapter mapping the contract onto Anthropic Structured Outputs via the SDK's `messages.parse` + `zodOutputFormat`, with prompt caching applied inside the adapter.
- Versioned prompt convention `src/prompts/<name>_v<n>.ts`.
- A deterministic fake provider so the port and its consumers test end to end with no network and no key.
- The port/adapter seam encoded as a dependency-cruiser rule.

**Non-Goals:**
- No concrete qualify/draft prompt (owned by `qualification`/`drafting`).
- No non-Anthropic adapter and no no-native-mode fallback path (built when such a provider is added; ADR-0003 anticipates it).
- No streaming or multi-turn chat surface; the contract is single-shot, data-returning.
- No database table, no jobs dependency (the port is stateless).

## Decisions

### D-A: Module layout - `src/lib/llm/`, all `server-only`
- `provider.ts` - the `LLMProvider` port, the `LLMRequest`/`LLMResult` types, the `Prompt` descriptor type, and the typed errors (`LLMValidationError`, `LLMProviderError`). MUST NOT import a concrete adapter.
- `anthropic.ts` - the Anthropic default adapter.
- `fake.ts` - the deterministic fake provider.
- `index.ts` - `getLLM(name?)`: the accessor that selects the default adapter from config. This is the only module that imports the concrete adapters (the composition point, mirroring `signals/registry.ts`).

Reuses, no parallel mechanisms: config via `src/lib/config/env` (`getConfig().anthropicApiKey`), logging via `src/lib/log`. No `src/lib/db` and no jobs import.

### D-B: The contract is single-shot, schema-first, metadata-returning
```ts
interface LLMRequest<T> {
  prompt: Prompt;                                  // { name, version, system? }
  messages: { role: "user" | "assistant"; content: string }[];
  schema: z.ZodType<T>;                            // zod v4 (see D-E)
  model: string;
  maxTokens: number;
}
interface LLMResult<T> {
  data: T;                                         // schema-valid
  provider: string;
  model: string;
  promptVersion: string;
}
interface LLMProvider {
  readonly name: string;
  complete<T>(req: LLMRequest<T>): Promise<LLMResult<T>>;
}
```
The schema is the provider-neutral common-ground contract (ADR-0003). `complete` returns a validated object or throws a typed error (D-I); there is no partially-parsed result. Model and maxTokens are explicit so callers (qualify vs draft) tune cost without a provider-specific knob.

### D-C: The Anthropic adapter uses `messages.parse` + `zodOutputFormat` (verified against SDK 0.97.0)
The adapter calls `client.messages.parse({ model, max_tokens, system, messages, output_config: { format: zodOutputFormat(req.schema) } })` and reads `message.parsed_output` (verified in `node_modules/@anthropic-ai/sdk/resources/messages/messages.d.ts` and `helpers/zod.d.ts`). The SDK's transform (`lib/transform-json-schema.js`, on by default) strips JSON-Schema keywords Anthropic's wire format rejects, and `parse` validates the response against the original Zod schema locally - so the two-layer split (structural subset on the wire, full Zod after parse) is the SDK's behavior, not hand-rolled (ADR-0003). A `null` `parsed_output` or a parse throw becomes an `LLMValidationError`; an SDK/transport/auth error becomes an `LLMProviderError`.

### D-D: Prompt caching lives inside the Anthropic adapter
For a prompt whose system text is large (> ~1024 tokens), the adapter sends `system` as a content block carrying `cache_control: { type: "ephemeral", ttl: "1h" }` (CLAUDE.md: the default TTL dropped to 5 min in March 2026, so 1h is set explicitly). This is non-portable and stays in the adapter, never in the port contract (ADR-0003). The threshold is applied by the adapter from the prompt's declared size or a simple length heuristic; callers never set caching.

### D-E: Schemas are Zod v4, matching the SDK helper
`helpers/zod.ts` imports `zod/v4`; the repo's `zod` is 4.4.3, so `import { z } from "zod"` is already v4 - the `zodOutputFormat(schema)` helper accepts our schemas directly. Cross-field/semantic rules that no provider schema can express go in a Zod `.refine`/`.superRefine`, validated after parse (ADR-0003).

### D-F: `getLLM()` returns the memoized default; consumers swap via injection
`getLLM()` returns the memoized default provider (the Anthropic adapter). Consumers that must run against the fake under test take an `LLMProvider` parameter defaulting to `getLLM()` and pass `createFakeLLM(...)` - so swapping the provider never changes the call site. A name-based registry is deferred until a second real adapter exists (the fake needs a per-test handler, so it is injected, not name-registered). The Anthropic adapter reads `getConfig().anthropicApiKey` lazily; a call made without a key throws a clear `LLMProviderError` (not an opaque SDK 401), so the missing-key failure is legible. No test needs a key or network.

### D-G: The fake provider is deterministic and validates its own output
`createFakeLLM(handler)` returns an `LLMProvider` whose `complete` runs `req.schema.parse(handler(req))` and returns the result with `provider: "fake"`. Tests supply a `handler` returning a canned object; running it through the same schema guarantees test fixtures are themselves schema-valid and exercises the validation path without a network. The fake is also how `qualification`/`drafting` will be tested against the port.

### D-H: Typed errors distinguish validation from provider failure
`LLMValidationError` (carries the Zod issues and the raw content) and `LLMProviderError` (carries the underlying cause) both extend `Error` with a discriminant `kind`. Callers can branch on `kind` to retry a transient provider failure versus surface a contract mismatch (spec: a provider failure is distinguishable from a validation failure). The Anthropic SDK throws a generic `AnthropicError` for a structured-output parse OR schema-validation failure (message starts "Failed to parse structured output", verified in 0.97.0 `helpers/zod.js` + `lib/parser.js`); a pure `toLLMError` classifier (`anthropic-errors.ts`, not coverage-excluded) maps that to `LLMValidationError` and everything else to `LLMProviderError`, so a schema mismatch is never mislabeled a retryable provider failure. Keeping the classifier pure and separate from the network call is what makes this discrimination unit-testable.

### D-I: Encode the port/adapter direction as a dependency-cruiser rule
Following `signal-ingestion`'s D-M: `provider.ts` (the port) MUST NOT import `anthropic.ts` or `fake.ts`; the concrete adapters are reached only through `index.ts` (`getLLM`). This protects the dependency-inversion seam by the build.

## Risks / Trade-offs

- **The Anthropic adapter's `complete` is not unit-testable without a key/network** -> excluded from coverage like the pg-boss wrappers (`docs/engineering.md` precedent); the port contract, the fake, the error types, and `getLLM` selection are all covered by unit tests, and the adapter is exercised by a live smoke when a real key is present. The fake provider is what downstream capabilities test against.
- **A prompt larger than the cache threshold but mis-measured** -> caching is a cost optimization, not correctness; a missed cache costs latency/tokens, never a wrong result.
- **Zod v4 keyword stripping by the SDK transform could drop a constraint silently on the wire** -> the SDK still validates the full Zod schema locally after parse (D-C), so a dropped wire constraint becomes a local validation failure, not a silently-accepted bad object.
- **Provider-neutral contract is more work than coding to one SDK** -> accepted as the cost of D9 agnosticism; only the Anthropic default and the fake ship now.

## Migration Plan

No database, no migration. New code only:
1. `provider.ts` (port + types + errors), then `fake.ts`, then `anthropic.ts`, then `index.ts` (`getLLM`).
2. Add the dependency-cruiser port/adapter rule (D-I) and confirm `depcruise` passes.
3. Unit-test the contract via the fake (schema-valid result, validation failure, metadata, error discrimination) and `getLLM` selection.
4. Exclude `anthropic.ts` from coverage with the documented rationale.
5. **Rollback:** nothing depends on the port yet; deleting `src/lib/llm` and the rule is the down path.

## Open Questions

- Default model id per call site (qualify vs draft) - deferred to those capabilities; the port takes `model` explicitly so each picks its own.
- Whether a retry/backoff policy belongs in the adapter or the calling job - leaning job-side (pg-boss already retries), revisit when `qualification` wires the first real call.
- The exact prompt-size threshold and how a `Prompt` declares its cacheability - a simple length heuristic now; refine when the first large system prompt (the ICP rubric) lands in `qualification`.
