## Actors

- **CRM user**: the operator (freelancer, solopreneur, consultant, developer) running outreach for their own book of business. Wants to judge each signal exactly once, at triage, and then work people by pipeline position - not re-litigate fit with a second score.
- **LLM provider** (external): scores each pending signal against the rubric of its kind (the advisory filter, ADR-0017) and generates messages/comments on demand, behind the `LLMProvider` port (ADR-0003). After this change it is never asked to score a person.

## Use cases

### UC1: Judge a signal once, at triage (CRM user)

- **Main success**: The user opens the Queue; every fresh, undecided signal carries its kind's advisory score. The user approves what is worth keeping (the entity is created and the item drops out) or dismisses the rest. That verdict is the qualification - no later score restates it.
- **Alternates/exceptions**: a signal with no active rubric of its kind shows no score and is still decidable (the advisory is a hint, never a gate - ADR-0013 stands).

### UC2: Work a person by pipeline position (CRM user)

- **Main success**: The user opens the People list and a person's workspace and sees identity, pipeline status, source, and working materials (dossier, messages, comments). On-demand actions are generate, enrich, and move-status. No score, no qualification badge, no re-score action exists on a person.
- **Alternates/exceptions**: when the user wants to revisit why a person was admitted, the originating signal (via the person's signal link) still shows the advisory score that informed the approval; a manual-origin person has no signal and simply has no score anywhere - accepted by design.

### UC3: Log an outcome without a score snapshot (CRM user)

- **Main success**: After acting manually (D2), the user logs the outcome (connected, replied, booked, no response) against the person and the artifact acted on. No score-at-time is recorded; the future learning loop (D7, deferred) will bind outcomes to signal advisory data when it is designed.

## Primary journey

1. Configure ICP rubrics, sources, and the user profile - ICP & source config (anchor view #1).
2. Sources scan on schedule; each persisted signal gets an advisory score of its kind - background jobs (scan + advisory filter; the only scoring in the system).
3. Triage the Queue: approve (creates exactly the routed entity, nothing else - no score written) or dismiss - the Queue (the sole intake surface).
4. Work a person on demand: generate a message or comment, enrich, move pipeline status - the Person workspace.
5. Watch monitored people's activity and comment on fresh posts - the Feed.
6. Post manually and log the outcome against the person and artifact - manual, D2.

## Acceptance signals

- UC1: Is the signal advisory score the only score concept in the system, shown where the judgment happens, and does approval create the routed entity in one transaction while writing no score and making no LLM call (cost-control + simplicity attributes)?
- UC2: Can every People surface (list, detail, workspace) be rendered without any scoring read - identity, pipeline status, source, and facets only - and does no server action exist that scores a person (cost-control attribute: no path can spend LLM budget on person scoring)?
- UC2: Can the design still answer "why is this person here" via the person-to-signal link to the advisory score, without storing a copy on the person?
- UC3: Is an outcome recordable with no score snapshot, with the data forfeit named rather than hidden - today's `signal_advisory` is a mutable hint, not a learning-grade record, so the future D7 design must introduce its own durable binding (learning-loop integrity attribute, satisfied vacuously today)?
