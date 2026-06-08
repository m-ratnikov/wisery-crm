# ADR-0021: LinkedIn Message entity, connection-request as a message type

- Status: proposed
- Date: 2026-06-08
- Supersedes: none
- Refines: ADR-0018 (engagement artifacts - adds Message as a sibling of Comment)
- Source: docs/explore/2026-06-08-engagement-rework-queue-pipelines-messages.md; domain-model.md (Entity model)

## Context

With the drafting stage removed (ADR-0019), first-touch outreach needs a home. <!-- v:derives ADR-0019 --> The owner's model distinguishes two LinkedIn artifacts: a general message (including a connection-request, which is a type of message that appears in the person's message history) and a comment (a reply keyed to a specific Post, kept as the ADR-0018 entity). <!-- v:fact docs/explore/2026-06-08-engagement-rework-queue-pipelines-messages.md --> ADR-0018 already established the synchronous, per-row, human-posted generation pattern for Comment and noted that a comment is a separate table from the old `drafts` because its business rule differs (per-post, many-per-person). <!-- v:derives ADR-0018 --> A message has yet another rule: keyed to a person (not a post), many per person, carrying a message type. Merging Message and Comment into one table would lose the post-context distinction the owner wants to keep. <!-- v:fact docs/explore/2026-06-08-engagement-rework-queue-pipelines-messages.md -->

## Decision

We will add a `Message` entity for LinkedIn messages, generated on demand.

- **`Message`**: a LinkedIn message attached to a `Person`, with a `type` (`connection_request` or `message`), a `body`, a status, and the eval fields (`provider`, `prompt_version`, `model`) like a Comment. Many per person; they form the person's message history. <!-- v:decision -->
- **Connection-request is a type, not an entity**: a CR is `Message(type = connection_request)`, not its own table. <!-- v:decision -->
- **Generated on demand through the existing port**: a synchronous user-triggered server action calls `LLMProvider` with a versioned LinkedIn prompt (`src/prompts/<name>_v<n>`) and Structured Outputs, writing one row per call - the same shape as the comment generator, no pg-boss job, no auto-send. <!-- v:derives ADR-0018 -->
- **Comment is unchanged**: it stays the post-linked entity of ADR-0018; Message does not absorb it. <!-- v:derives ADR-0018 -->
- **Channel discriminator deferred (NC1)**: v1 ships LinkedIn-only - a `Message` table (LinkedIn) and the existing `Comment` table (LinkedIn). When X / email / Telegram arrive, these tables will likely gain a `channel` field rather than spawn per-channel tables, but discriminator-field vs per-channel-table is left to a later investigation and is not decided here. <!-- v:assumption NC1 channel model deferred -->

## Consequences

Easier: first-touch and follow-up outreach have a home that mirrors the proven comment-generation seam (LLM port, versioned prompt, eval fields, manual post), so the Message generator is a near-copy of `src/lib/comments/generate.ts`; message history feeds the Person workspace. <!-- v:fact src/lib/comments/generate.ts --> Harder/accepted: a second generative entity and a second versioned prompt to maintain; two LinkedIn artifact tables that a future channel model may need to reconcile (NC1). Rules out: a single unified message/comment table in v1, and any auto-send path (the CRM user posts every message manually, D2). <!-- v:fact docs/product-overview.md D2 --> This refines ADR-0018 by adding Message as a sibling artifact under the same human-posted, synchronous-generation principle; it adds no new external system and no new port - generation reuses `LLMProvider`. <!-- v:derives ADR-0003 -->
