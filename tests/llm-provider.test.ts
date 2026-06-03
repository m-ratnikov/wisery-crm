import { describe, expect, it } from "vitest";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { getLLM, LLMProviderError, LLMValidationError } from "@/lib/llm";
import { toLLMError } from "@/lib/llm/anthropic-errors";
import { createFakeLLM } from "@/lib/llm/fake";
import type { LLMRequest, Prompt } from "@/lib/llm/provider";

const prompt: Prompt = { name: "test", version: "v1" };
const schema = z.object({ score: z.number(), reason: z.string() });

function req<T>(s: z.ZodType<T>): LLMRequest<T> {
  return {
    prompt,
    messages: [{ role: "user", content: "hi" }],
    schema: s,
    model: "test-model",
    maxTokens: 256,
  };
}

describe("llm-provider: the fake provider (offline contract)", () => {
  it("returns a schema-valid object carrying provider, model, and prompt version", async () => {
    const llm = createFakeLLM(() => ({ score: 4, reason: "on ICP" }));
    const result = await llm.complete(req(schema));
    expect(result.data).toEqual({ score: 4, reason: "on ICP" });
    expect(result.provider).toBe("fake");
    expect(result.model).toBe("test-model");
    expect(result.promptVersion).toBe("v1");
  });

  it("rejects an output that fails the caller's schema with a validation error", async () => {
    const llm = createFakeLLM(() => ({ score: "not-a-number", reason: "x" }));
    await expect(llm.complete(req(schema))).rejects.toBeInstanceOf(LLMValidationError);
  });
});

describe("llm-provider: typed error discrimination", () => {
  it("tags validation and provider failures with distinct kinds", () => {
    expect(new LLMValidationError("bad", [], null).kind).toBe("validation");
    expect(new LLMProviderError("down").kind).toBe("provider");
  });
});

describe("llm-provider: Anthropic error classification", () => {
  it("classifies a structured-output parse/validation failure as a validation error", () => {
    // The SDK throws this for both bad JSON and schema mismatch (verified in 0.97.0).
    const err = new Anthropic.AnthropicError(
      "Failed to parse structured output: score expected number",
    );
    const mapped = toLLMError(err);
    expect(mapped).toBeInstanceOf(LLMValidationError);
    expect(mapped.kind).toBe("validation");
  });

  it("classifies a transport/provider error as a provider error, preserving message + cause", () => {
    const original = new Error("socket hang up");
    const mapped = toLLMError(original);
    expect(mapped.kind).toBe("provider");
    // Keep the diagnostic context: the original message is carried, and `cause` chains to
    // the underlying error so the failure is debuggable from the log.
    expect(mapped.message).toContain("socket hang up");
    expect(mapped.cause).toBe(original);
  });

  it("classifies a non-parse AnthropicError (e.g. rate limit) as a provider error", () => {
    expect(toLLMError(new Anthropic.AnthropicError("429 rate limit")).kind).toBe("provider");
  });
});

describe("llm-provider: provider selection", () => {
  it("getLLM returns the default Anthropic-named provider", () => {
    expect(getLLM().name).toBe("anthropic");
  });

  it("memoizes the default provider instance", () => {
    expect(getLLM()).toBe(getLLM());
  });
});
