import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { getConfig } from "@/lib/config/env";
import { toLLMError } from "@/lib/llm/anthropic-errors";
import {
  type LLMProvider,
  type LLMRequest,
  type LLMResult,
  LLMProviderError,
  LLMValidationError,
} from "@/lib/llm/provider";

// The default adapter (ADR-0003): maps the port contract onto Anthropic Structured
// Outputs via messages.parse + zodOutputFormat. The SDK's transform strips JSON-Schema
// keywords the wire format rejects and validates the response against the original Zod
// schema locally (the two-layer split is the SDK's behavior, not hand-rolled).

// ~1024 tokens. Above this the system prompt gets a 1h ephemeral cache breakpoint, a
// non-portable Anthropic optimization that stays inside this adapter (D-D).
const LARGE_PROMPT_CHARS = 4096;

function buildSystem(system?: string): string | Anthropic.Messages.TextBlockParam[] | undefined {
  if (!system) return undefined;
  if (system.length <= LARGE_PROMPT_CHARS) return system;
  return [{ type: "text", text: system, cache_control: { type: "ephemeral", ttl: "1h" } }];
}

export function createAnthropicLLM(): LLMProvider {
  let client: Anthropic | undefined;
  const getClient = (): Anthropic => {
    if (!client) {
      const apiKey = getConfig().anthropicApiKey;
      if (!apiKey) {
        throw new LLMProviderError(
          "ANTHROPIC_API_KEY is not set; the Anthropic LLM adapter cannot make calls",
        );
      }
      client = new Anthropic({ apiKey });
    }
    return client;
  };

  return {
    name: "anthropic",
    async complete<T>(req: LLMRequest<T>): Promise<LLMResult<T>> {
      // Construct outside the try so a missing-key configuration error surfaces as a
      // clean provider failure, not an opaque transport error.
      const client = getClient();
      const system = buildSystem(req.prompt.system);

      try {
        const message = await client.messages.parse({
          model: req.model,
          max_tokens: req.maxTokens,
          ...(system ? { system } : {}),
          messages: req.messages,
          output_config: { format: zodOutputFormat(req.schema) },
        });
        const parsed = message.parsed_output;
        if (parsed === null || parsed === undefined) {
          // No text block at all (empty or max_tokens-truncated response). No result was
          // produced, so this is a PROVIDER failure (often transient/retryable), not a
          // schema-validation failure - a result that arrived but failed the schema is what
          // the SDK throws and toLLMError maps to LLMValidationError (D-H contract).
          throw new LLMProviderError("Anthropic returned no content to parse");
        }
        return {
          data: parsed,
          provider: "anthropic",
          model: req.model,
          promptVersion: req.prompt.version,
        };
      } catch (err) {
        // Our own typed errors (the no-content LLMProviderError, or any LLMValidationError)
        // pass through unwrapped; everything the SDK throws is classified into validation
        // (schema/parse failure) vs provider (transport/auth/provider) by toLLMError (D-H).
        if (err instanceof LLMProviderError || err instanceof LLMValidationError) throw err;
        throw toLLMError(err);
      }
    },
  };
}
