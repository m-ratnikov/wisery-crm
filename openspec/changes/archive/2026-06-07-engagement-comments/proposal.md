## Why

ADR-0018 (Comment, human-posted, extends D2) is accepted, and the posts substrate is in place. This final slice adds the engagement payoff: on a post in the Feed, the CRM user generates an AI comment grounded in the person's info and a global comment guidance, edits it, posts it **manually**, and marks it posted. It reuses the generative pattern (LLMProvider, versioned prompt, eval fields) but a different business rule from Draft - per-post, many-per-person - so a separate table.

## What Changes

- **Migration**: `comments` table - `post_id` FK, `person_id` (denormalized for the person-360 read), `body`, `status` (text + Zod `generated | posted | dismissed`), `provider`/`prompt_version`/`model`, `created_at`. And `comment_guidance` - a single versioned config-as-data row (`guidance` jsonb, `version`, `active`; a partial unique index `WHERE active`).
- **Versioned comment prompt** `src/prompts/comment_v1.ts` (with `cache_control` ephemeral 1h if over 1024 tokens).
- **Comment generation as a synchronous server action** (not a pg-boss job): the Feed post-detail action invokes the comment core -> `LLMProvider`, writing a **new** `Comment` row per call. Regenerate writes another row; a transient LLM 429 surfaces to the user (who retries) - no background retry, no double-bill.
- **Feed post detail**: generate, edit, copy, **mark posted** (the human posts on the channel, D2), and dismiss - the comment lifecycle.
- **Comment guidance config** surface (settings): edit the global tone/rules.

## Capabilities

### New Capabilities

- `engagement-comments`: the CRM user generates an AI-drafted comment on a post (grounded in the person + global guidance), edits and regenerates it, posts it by hand, and marks it posted. No comment is ever auto-posted.

## Impact

- **Migration**: one Drizzle migration adding `comments` + `comment_guidance` (serial journal - author isolated).
- **New code**: the comment core + the synchronous generate server action; the versioned comment prompt; the Feed post-detail comment UI (generate/edit/copy/mark-posted/dismiss); the comment-guidance settings surface.
- **Reuses**: the `LLMProvider` port (D9, ADR-0003, Anthropic Structured Outputs), the versioned-prompt discipline, the `db` facade, the Feed post detail from the posts slice. It does NOT reuse the `drafts` table (one-selected-per-person is the wrong rule) nor a pg-boss handler (generation is synchronous).
- **Governed by**: ADR-0018 (Post + Comment, human-posted), ADR-0003 (LLMProvider), D2 (action stays human), D10 (PII server-side).
- **Deferred**: a comment -> outcome learning loop (the engagement analog of D7).
