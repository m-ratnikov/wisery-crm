## Context

The posts slice has landed `posts` and the Feed post detail. This slice adds the AI comment on a post. It mirrors the Draft generative pattern (LLMProvider, versioned prompt, provider/prompt_version/model recorded for evals) but follows a different business rule, and keeps the action human (D2).

## Goals / Non-Goals

**Goals:** the `comments` + `comment_guidance` schema; the versioned comment prompt; the synchronous generate action; the Feed post-detail comment lifecycle (generate/edit/copy/mark-posted/dismiss); the guidance settings surface.

**Non-Goals:** a comment -> outcome learning loop (deferred); auto-posting of any kind (forbidden, D2); reusing the drafts table; a background/queued generation path.

## Decisions

### D1. A separate `comments` table, not `drafts`

DRY is one representation per business rule, not textual sameness. A draft is per-person with a one-selected invariant (`drafts_one_selected_uq`); a comment is per-post and many-per-person with no one-selected rule. Sharing the table would force the wrong index onto comments. So `comments` is its own table; `Comment.person_id` is denormalized from its post so the person-360 read does not walk posts (ADR-0018).

### D2. Generation is a synchronous server action, not a pg-boss job

Generation is user-triggered, interactive, and cost-bounded - the user clicks, waits, and gets a draft. So it is a synchronous server action calling the comment core, not a retrying queue handler. Each generate or regenerate writes a **new** `Comment` row, so there is no idempotency key to maintain and no automatic retry that could double-bill; a transient LLM 429 surfaces to the user, who clicks again. (This is the contradiction the architecture review caught and fixed - comment generation is deliberately not in the jobs monitor.)

### D3. Comment guidance is a config-as-data singleton; the prompt is versioned

`comment_guidance` is one active versioned row (a peer of Rubric and User Profile), read via the `db`/config seam and edited in settings. The comment prompt lives at `src/prompts/comment_v<n>.ts` for `prompt_version` traceability; if it exceeds 1024 tokens, set `cache_control` ephemeral with `ttl: '1h'` in the Anthropic adapter. The LLM call goes through the `LLMProvider` port with Anthropic Structured Outputs (D9, ADR-0003), never `tool_use`.

### D4. The human posts every comment

The comment lifecycle is Generated -> Posted (the user marks it after posting on the channel by hand) or Generated -> Dismissed; regenerate starts a new Generated instance. No path publishes a comment automatically - the only outbound action is the manual human one (D2). Posts and comments are third-party PII held server-side behind the same boundary as dossiers (D10).
