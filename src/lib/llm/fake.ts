import "server-only";
import {
  type LLMProvider,
  type LLMRequest,
  type LLMResult,
  LLMValidationError,
} from "@/lib/llm/provider";

// A deterministic, no-network, no-key provider (D-G) so the port and its consumers
// (qualification, drafting) are testable offline. The handler returns a canned object;
// running it through the caller's own schema guarantees test fixtures are schema-valid
// and exercises the same validation path the real adapters use.
export function createFakeLLM(handler: (req: LLMRequest<unknown>) => unknown): LLMProvider {
  return {
    name: "fake",
    complete<T>(req: LLMRequest<T>): Promise<LLMResult<T>> {
      const produced = handler(req);
      const parsed = req.schema.safeParse(produced);
      if (!parsed.success) {
        return Promise.reject(
          new LLMValidationError(
            "fake provider output failed schema validation",
            parsed.error.issues,
            produced,
          ),
        );
      }
      return Promise.resolve({
        data: parsed.data,
        provider: "fake",
        model: req.model,
        promptVersion: req.prompt.version,
      });
    },
  };
}
