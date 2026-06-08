## Actors

- **CRM user**: the operator (freelancer, solopreneur, consultant, developer) running outreach for their own book of business. Wants to control what enters the CRM, work each person with AI assistance on demand, and move people through a pipeline they configure.
- **LLM provider** (external): generates a message or a comment when the user asks, behind the `LLMProvider` port (ADR-0003). Drives the on-demand generation use cases.
- **Enrichment provider** (external, optional): supplies a deep dossier or a person's latest posts when the user triggers it (ADR-0007). Drives the on-demand enrich use case.

## Use cases

### UC1: Triage the unified Queue (CRM user)
- **Main success**: The user opens the Queue - one inbox of fresh, undecided signals of every kind, each annotated with its kind's advisory score and filterable by score. For an item worth keeping, the user clicks "Create Person" (or "Create Company"); the entity is created and the item drops out of the Queue. For an item not worth keeping, the user dismisses it and it drops out.
- **Alternates/exceptions**: a concurrent double-approve of the same signal is resolved by the `signal_decisions.signal_id` UNIQUE - the second attempt is a no-op, not a duplicate entity.

### UC2: Work a person in their workspace (CRM user)
- **Main success**: The user opens a Person's details page - general/PII, posts history, message history - and runs on-demand actions: generate a LinkedIn message (connection-request or a general message), generate a comment on one of the person's posts, re-score against the ICP rubric, or enrich. Each action runs synchronously, writes one row, and surfaces the result inline; nothing is auto-generated.
- **Alternates/exceptions**: an LLM or enrichment error surfaces to the user on that action (no retrying background job, no double-bill), consistent with ADR-0018.

### UC3: Move a person through a configurable pipeline (CRM user)
- **Main success**: The user sets a Person's status by choosing from the statuses of a pipeline they own. A default pipeline and its ordered statuses are seeded from code; the user can add, rename, reorder, or remove statuses. Status is a property of the Person, decoupled from whether any artifact (message, comment, dossier) exists.
- **Alternates/exceptions**: removing a status that people still occupy is a status-management decision surfaced to the user, not a silent reassignment (handled at build time).

### UC4: Send the message yourself (CRM user)
- **Main success**: The user reads a generated message or comment, edits if desired, posts it manually through the channel, and marks it sent/posted. The system never sends (D2).

## Primary journey

1. Configure ICP, sources, and the user profile - ICP & source config (anchor view #1).
2. Sources scan on schedule; each persisted signal gets an advisory score - background jobs (scan + advisory filter).
3. Triage the Queue: approve (Create Person/Company) or dismiss; decided items drop out; approval creates the entity and promotes the signal's advisory score into the person's initial assessment Scoring (no LLM) - the Queue (the sole intake surface).
4. Open a person and work them: generate a message or a comment, re-score, or enrich - all on demand - the Person workspace (the person list / detail).
5. Move the person through the pipeline by setting status - the Person workspace + pipeline config.
6. Watch monitored people's activity and comment on fresh posts - the Feed (anchor view #4).
7. Post the message or comment manually and log the outcome against the score - manual, D2/D7.

## Acceptance signals

- UC1: Can the design surface every fresh, undecided signal of any kind in one Queue, ranked by an advisory score, and drop an item the instant it is decided - with the read staying a LEFT JOIN so an un-scored signal still appears (anti-strand)?
- UC1: Does approval create the routed entity and promote the advisory score into an `advisory`-provenance initial Scoring in one transaction, with zero LLM cost and no downstream job to strand - so a Queue-created prospect carries its initial assessment from creation while a manual person stays unscored until re-scored (cost-control + anti-strand attributes)?
- UC2: Can a message, a comment, a re-score, and an enrich each run as a synchronous on-demand action on the Person that writes exactly one row, with spend incurred only on that click (cost-control attribute)?
- UC3: Can a Person's status be any status of a user-configured pipeline, seeded from code but CRUD-able, with status decoupled from artifact existence - and can the enum -> FK migration preserve every existing person's status (data-preservation attribute)?
- UC4: Does every outbound message and comment require a manual human post, with no auto-publish path crossing the boundary (D2)?
