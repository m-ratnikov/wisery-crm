## Glossary

Out of scope for this change (domain-model marked Skip in the proposal). No new domain noun is introduced. The relevant existing terms - Signal, Prospect, Scoring, Dossier, Draft, and the Prospect disposition states - are unchanged; see docs/architecture/domain-model.md and the glossary.

## Entity model

No entity shape, attribute, or relationship changes. This change alters the *durability* of the transitions between existing states, not the model. The entity model in docs/architecture/domain-model.md stands as-is.

## Lifecycle

The Prospect lifecycle states and transitions are unchanged (ADR-0008). What changes is that each transition and its follow-on job now commit atomically, so the lifecycle can no longer stall between two states because an enqueue failed after the state write. No new state is added.

## Domain events

The events and their job-stage mapping are unchanged. The only canon revision is to the prose note beneath the events table in docs/architecture/domain-model.md: the "Current implementation note" describing the at-least-once fire-and-forget hooks and the transient-enqueue-failure strand is replaced by the atomic enqueue-in-transaction resolution (each `*Persisted` / `*Qualified` / `*Enriched` event enqueues the next stage's job inside the same Drizzle transaction as its state write). The table rows themselves do not change.
