import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { LLMProviderError, LLMValidationError } from "@/lib/llm/provider";

// Map an error thrown by the Anthropic SDK to the port's typed errors (D-H). This is a
// pure function so the validation-vs-provider discrimination is unit-testable without a
// key or network (the network call in anthropic.ts is what stays coverage-excluded).
//
// The SDK throws a generic AnthropicError for a structured-output parse OR schema-
// validation failure, with a message starting "Failed to parse structured output"
// (verified in @anthropic-ai/sdk 0.97.0 helpers/zod.js + lib/parser.js). That is a
// contract mismatch - the result arrived but is not schema-valid - so it is a validation
// failure a caller must NOT retry, distinct from transport/auth/provider errors. Matching
// on the message is the only signal the SDK exposes; re-verify on SDK upgrade.
const PARSE_FAILURE_PREFIX = "Failed to parse structured output";

export function toLLMError(err: unknown): LLMValidationError | LLMProviderError {
  if (err instanceof Anthropic.AnthropicError && err.message.startsWith(PARSE_FAILURE_PREFIX)) {
    return new LLMValidationError(err.message, null, undefined);
  }
  const message = err instanceof Error ? err.message : String(err);
  return new LLMProviderError(`Anthropic call failed: ${message}`, { cause: err });
}
