## 1. The port and contract types

- [x] 1.1 Create `src/lib/llm/provider.ts` (`server-only`): the `LLMProvider` interface (`readonly name`, `complete<T>(req): Promise<LLMResult<T>>`), the `LLMRequest<T>` and `LLMResult<T>` types, and the `Prompt` descriptor type (`name`, `version`, optional `system`) (D-A, D-B)
- [x] 1.2 Add the typed errors in `provider.ts`: `LLMValidationError` and `LLMProviderError`, both extending `Error` with a discriminant `kind` ("validation" | "provider"), carrying the Zod issues + raw content / the underlying cause respectively (D-H, D-I)
- [x] 1.3 Confirm `provider.ts` imports no concrete adapter (port stays dependency-free of adapters)

## 2. The fake provider (offline testability)

- [x] 2.1 Create `src/lib/llm/fake.ts` (`server-only`): `createFakeLLM(handler: (req: LLMRequest<unknown>) => unknown)` returning an `LLMProvider` whose `complete` runs `req.schema.parse(handler(req))` and returns `{ data, provider: "fake", model: req.model, promptVersion: req.prompt.version }`; a thrown Zod error surfaces as `LLMValidationError` (D-G)

## 3. The Anthropic default adapter

- [x] 3.1 Create `src/lib/llm/anthropic.ts` (`server-only`): a `createAnthropicLLM()` returning an `LLMProvider` (`name: "anthropic"`) that lazily constructs `new Anthropic({ apiKey })` from `getConfig().anthropicApiKey`, throwing a clear `LLMProviderError` if the key is absent when a call is made (D-C, D-F)
- [x] 3.2 Implement `complete` via `client.messages.parse({ model, max_tokens, system, messages, output_config: { format: zodOutputFormat(req.schema) } })` reading `message.parsed_output`; map a no-content result to `LLMValidationError` and classify thrown SDK errors through a pure `toLLMError` helper (`src/lib/llm/anthropic-errors.ts`): a structured-output parse/schema failure (the SDK throws an `AnthropicError` whose message starts "Failed to parse structured output", verified in 0.97.0) becomes `LLMValidationError`, everything else `LLMProviderError`; return `{ data, provider: "anthropic", model, promptVersion }` (D-C, D-H)
- [x] 3.3 Apply prompt caching inside the adapter: when the prompt's `system` text exceeds the large-prompt threshold, send `system` as a content block with `cache_control: { type: "ephemeral", ttl: "1h" }` (D-D); never expose this in the port contract
- [x] 3.4 Verify the `zodOutputFormat` import path and `messages.parse`/`parsed_output` shape against the installed `@anthropic-ai/sdk` 0.97.0 (`helpers/zod`, `resources/messages`) - do not code from memory (AGENTS.md)

## 4. Provider selection accessor

- [x] 4.1 Create `src/lib/llm/index.ts` (`server-only`): `getLLM(): LLMProvider` returning the memoized default (the Anthropic adapter); the only module wiring the default concrete adapter. Consumers swap it via dependency injection (an `LLMProvider` param defaulting to `getLLM()`); a name-based registry is deferred until a second real adapter exists (the fake needs a per-test handler) (D-A, D-F, D-I)
- [x] 4.2 Memoize the default Anthropic instance so repeated `getLLM()` calls reuse one client (lazy, side-effect-free import like `src/lib/db`)

## 5. Prompt-versioning convention

- [x] 5.1 Establish `src/prompts/` with a short `README.md` documenting the `<name>_v<n>.ts` convention and the `Prompt` shape; no concrete prompt ships here (qualify/draft own theirs)

## 6. Architectural boundary

- [x] 6.1 Add a dependency-cruiser rule to `.dependency-cruiser.cjs`: `src/lib/llm/provider.ts` MUST NOT import `anthropic.ts` or `fake.ts`; concrete adapters are reached only through `index.ts` (D-I, the engineering.md port/adapter extension point)
- [x] 6.2 Run `npm run depcruise` and confirm the new rule passes

## 7. Tests

- [x] 7.1 Unit-test the fake provider: a handler returning a schema-valid object yields `{ data, provider: "fake", model, promptVersion }`; a handler returning a schema-invalid object surfaces `LLMValidationError` (spec: schema-valid object; invalid result rejected)
- [x] 7.2 Unit-test the error discrimination: `LLMValidationError.kind === "validation"` and `LLMProviderError.kind === "provider"` are distinguishable by callers (spec: provider failure distinguishable from validation failure)
- [x] 7.3 Unit-test `getLLM`: `getLLM()` returns the default provider named "anthropic" and is memoized; it is structurally interchangeable with `createFakeLLM(...)` (both `LLMProvider`), the basis for injection-based swapping (spec: provider-neutral; swapping leaves callers unchanged)
- [x] 7.4 Unit-test traceability: a completed call surfaces `promptVersion`, `provider`, and `model` alongside the result (spec: result carries prompt version, provider, model)
- [x] 7.5 Unit-test `toLLMError`: a "Failed to parse structured output" `AnthropicError` -> `LLMValidationError`; a transport `Error` and a non-parse `AnthropicError` -> `LLMProviderError` (spec: provider failure distinguishable from validation failure, on the real adapter's error path)

## 8. Verify, coverage, and docs

- [x] 8.1 Exclude `src/lib/llm/anthropic.ts` from coverage in `vitest.config.ts` with a documented rationale (a network adapter exercised by a live smoke when a key is present, not unit tests - the precedent of the pg-boss wrappers); keep `provider.ts`, `fake.ts`, `index.ts` covered by the unit tests
- [x] 8.2 Confirm the change adds no new env var (`ANTHROPIC_API_KEY` already present in `src/lib/config/env` and `.env.example`)
- [x] 8.3 Run `npm run verify` green (typecheck, lint, format, depcruise, dup, per-file coverage, build)
- [x] 8.4 Run a `code-review` pass with architecture context and `/opsx:verify` (conformance to design + ADR-0003) before archive
