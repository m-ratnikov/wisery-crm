## 1. Comments + guidance schema

- [x] 1.1 Add the `comments` table: uuid PK, `postId` FK, `personId` FK (denormalized), `body`, `status` (text + Zod `generated | posted | dismissed`), `provider`/`promptVersion`/`model`, `createdAt`.
- [x] 1.2 Add the `comment_guidance` table: uuid PK, `guidance` jsonb, `version`, `active` boolean, timestamps; a partial unique index `WHERE active` (single active row). `npm run db:generate`; confirm one additive migration.

## 2. Comment prompt

- [x] 2.1 Add `src/prompts/comment_v1.ts` (the versioned comment prompt, person info + guidance inputs); set `cache_control` ephemeral `ttl: '1h'` in the Anthropic adapter path if it exceeds 1024 tokens.

## 3. Comment core + synchronous generate action

- [x] 3.1 Add a comment core: `generateComment(postId)` resolves the post + person + active guidance, calls `LLMProvider` (Anthropic Structured Outputs, not tool_use), and writes a new `Comment` row (status `generated`) with provider/prompt_version/model. db-only core; no queue.
- [x] 3.2 Wire a synchronous Feed server action to the core (not a pg-boss handler); each generate/regenerate writes a new row; a 429 surfaces to the user.

## 4. Feed post-detail comment lifecycle

- [x] 4.1 On the Feed post detail: generate, edit the body, copy, **mark posted** (the user posts manually on the channel, D2 - no auto-publish), and dismiss. Multiple `generated` comments may coexist for one post; the user posts one and may dismiss the rest.

## 5. Comment guidance settings

- [x] 5.1 Add a settings surface to edit the global comment guidance (a new active versioned row on save, config-as-data).

## 6. Verification

- [x] 6.1 Unit: generate writes a new `Comment` per call (regenerate = new row, no idempotency key); mark-posted transitions only that row to `posted`; no code path posts a comment automatically (D2).
- [x] 6.2 Update the prototype registry (`src/app/prototype/README.md`) for the Feed post-detail comment UI and the guidance settings.
- [x] 6.3 `npm run verify` green; `code-review` pass on the diff, then re-run `verify` on the fix delta before archive.
