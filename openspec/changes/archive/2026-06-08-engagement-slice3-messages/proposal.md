# Why

Implements Slice 3 (final) of the engagement-rework (ADR-0021, now canon): the LinkedIn `Message` entity (connection-request as a type) plus a synchronous on-demand message generator and the Messages section on the Person workspace. Code realization of the architecture ratified in `openspec/changes/archive/2026-06-08-engagement-rework`.

# What Changes

- New `messages` table (mirrors `comments`): id, personId FK -> person onDelete restrict, type (text: connection_request | message), body, status (text default `generated`), provider/prompt_version/model provenance, createdAt, index on personId. Migration `0018` (additive).
- `src/lib/messages/generate.ts`: `generateMessage(personId, type)` - synchronous, user-triggered, one row per call, no pg-boss, errors surface to the user (ADR-0018/0019). Resolves identity through the PersonSubject seam, grounds in the operator profile, calls the `LLMProvider` port with `messagePromptV1` (`src/prompts/message_v1.ts`) and Structured Outputs. A near-mirror of the comment generator; Comment is untouched.
- `src/lib/messages/read.ts`: `listMessagesForPerson` + `markMessageSent` / `dismissMessage` (generated -> sent | dismissed; the human sends on LinkedIn and marks it, D2).
- Person workspace (`prospect-list/[id]`): a Messages section below Posts - draft a connection request or a message, and the message history with mark-sent / dismiss. The shared generated-state action row was extracted into a `GeneratedActions` component used by both the comment and message cards (rule of three).
- The Person workspace now hosts all the on-demand actions of ADR-0019: enrich, re-score, get-latest-posts/monitor, generate comment (per post), and generate message (per type).

The channel discriminator is deferred (NC1, ADR-0021): v1 ships LinkedIn-only Message + Comment.
