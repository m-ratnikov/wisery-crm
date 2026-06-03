import "server-only";
import { createAnthropicLLM } from "@/lib/llm/anthropic";
import type { LLMProvider } from "@/lib/llm/provider";

// The composition point (D-A, D-I): the only module that wires the default concrete
// adapter. Callers depend on the LLMProvider port and obtain the default via getLLM();
// consumers that need to swap it under test take an LLMProvider parameter defaulting to
// getLLM() and pass createFakeLLM(...) instead - so swapping the provider never changes
// the call site. A name-based registry is deferred until a second real adapter exists.

let defaultProvider: LLMProvider | undefined;

export function getLLM(): LLMProvider {
  // Lazy + memoized so importing this module is side-effect-free and the client is built
  // once (mirrors src/lib/db). Constructing the adapter does not require the API key; a
  // missing key fails only when a call is actually made.
  if (!defaultProvider) defaultProvider = createAnthropicLLM();
  return defaultProvider;
}

export type { LLMProvider, LLMRequest, LLMResult, Prompt } from "@/lib/llm/provider";
export { LLMValidationError, LLMProviderError } from "@/lib/llm/provider";
