# ADR-0018: Engagement artifacts - Post and Comment, human-posted

- Status: accepted
- Date: 2026-06-06
- Supersedes: none
- Source: docs/explore/2026-06-06-content-marketing-engagement.md; domain-model.md; system-design.md

## Context

The engagement motion needs to store a person's posting activity and an AI-drafted reply to a post. The system already has a generative-output pattern (`Draft`: regenerable, behind the `LLMProvider` port, with versioned prompts and provider/model recorded for evals) and an on-demand, cost-bounded fetch pattern (enrichment, ADR-0007). A comment is structurally similar to a draft but follows a different business rule: it is keyed to a post and there are many per person, whereas a draft is per-prospect with a one-selected invariant. The product thesis forbids automated sending; the same constraint applies to commenting.

## Decision

We will add two entities. `Post`: a person's content (external URL, content, posted-at), attached to a `Person`, created on demand ("get latest posts", reusing the user-triggered enrichment pattern, ADR-0007) or by a scheduled activity scan over monitored people; idempotent on `(person_id, dedup_key)`, where `dedup_key` is the provider's stable post/activity id when present, else a canonicalized permalink (query and fragment stripped, host normalized), and an item with no stable identifier is dropped rather than stored (anti-fabrication, consistent with UC4). `Comment`: an AI-drafted reply to a `Post`, generated through the `LLMProvider` port from the person's full info and the global comment guidance - a single versioned config-as-data row (a `comment_guidance` singleton, a peer of Rubric and User Profile) - recording provider/prompt_version/model like a draft; regenerable, many per person. Generation runs as a synchronous user-triggered server action, not a retrying pg-boss job: each generate or regenerate writes a new `Comment` row, so there is no idempotency key to maintain and no automatic retry that could double-bill. A comment is a separate table from `drafts` because its business rule differs (per-post, many-per-person vs per-prospect, one-selected). The CRM user posts every comment manually and marks it posted; no auto-publish path crosses the system boundary.

## Consequences

Easier: posting activity and comment history feed the person-360 detail and the Feed; comment generation reuses the LLM port, the versioned-prompt discipline (`src/prompts/comment_v<n>`), and the eval fields. Harder/accepted: two new entities and a second generative prompt; post and comment data are third-party PII held server-side behind the same boundary as dossiers. This extends D2 (intelligence automated, action human) to the engagement channel; it adds no new external system and no new port abstraction - fetching a person's post timeline is a new method on the existing `EnrichmentProvider` port (`fetchPosts`), distinct from deep-profile enrich. A `Post` created by approving a content signal is traced back to that signal through the author `Person.signal_id`; a fetched or scanned `Post` has no signal lineage, by design. A comment-to-outcome learning loop (engagement analog of D7) is deliberately deferred.
