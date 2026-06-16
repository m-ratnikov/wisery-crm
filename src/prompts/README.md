# Prompts

Versioned prompt artifacts for LLM calls made through the `LLMProvider` port
(`src/lib/llm`). Convention (CLAUDE.md, ADR-0003):

- One file per prompt version: `src/prompts/<name>_v<n>.ts` (e.g. `icp_score_v1.ts`).
- Each file exports a `Prompt` (`src/lib/llm/provider.ts`): `{ name, version, system? }`,
  where `version` is the `v<n>` recorded with every result for eval traceability.
- Editing a prompt's text means a **new** file/version, never mutating an existing one,
  so a past result's `promptVersion` still identifies the text that produced it.
- Prompts over ~1024 tokens are cached automatically by the Anthropic adapter
  (`cache_control` ephemeral, 1h) - callers do not set caching.

Current prompts: `icp_score_v1` (the rubric scorer behind the signal advisory filter -
the only score in the system, ADR-0022), plus the comment and message generation prompts
(ADR-0018/0021).
