import "server-only";
import type { z } from "zod";

// The LLMProvider port (ADR-0003, D9): all data-returning LLM calls go through this one
// provider-neutral, Zod-validated contract. Concrete adapters (Anthropic, the test fake)
// implement it and are reached only through ./index (getLLM); this module imports none.

// A versioned prompt descriptor. Prompt text lives in src/prompts/<name>_v<n>.ts; the
// version is recorded with every result for eval traceability (ADR-0003).
export interface Prompt {
  readonly name: string;
  readonly version: string;
  readonly system?: string;
}

export interface LLMRequest<T> {
  prompt: Prompt;
  messages: { role: "user" | "assistant"; content: string }[];
  // The provider-neutral common-ground contract: every adapter must satisfy this schema
  // and the result is validated against it before return (zod v4, see design D-E).
  schema: z.ZodType<T>;
  model: string;
  maxTokens: number;
}

export interface LLMResult<T> {
  data: T;
  provider: string;
  model: string;
  promptVersion: string;
}

export interface LLMProvider {
  readonly name: string;
  complete<T>(req: LLMRequest<T>): Promise<LLMResult<T>>;
}

// Typed failures (D-H): a caller can branch on `kind` to retry a transient provider
// failure versus surface a contract mismatch. A validation failure means a result
// arrived but did not satisfy the schema; a provider failure means the call never
// produced a usable result (transport, auth, provider error, or missing config).
export class LLMValidationError extends Error {
  readonly kind = "validation" as const;
  readonly issues: unknown;
  readonly raw: unknown;
  constructor(message: string, issues: unknown, raw: unknown) {
    super(message);
    this.name = "LLMValidationError";
    this.issues = issues;
    this.raw = raw;
  }
}

export class LLMProviderError extends Error {
  readonly kind = "provider" as const;
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "LLMProviderError";
  }
}
