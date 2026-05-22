## Actors

<!-- Each actor that touches this slice. Primary operating persona first. Name
     external/system actors (a recipient, a data source, a third-party API) only
     where they drive a use case. -->
- **{Actor}**: <one line on who they are and what they want from the system>

## Use cases

<!-- User-goal-level briefs (Cockburn "sea level") - a complete goal achieved in
     one sitting. NOT Agile user stories and NOT a backlog. A handful. -->

### UC1: {goal} ({primary actor})
- **Main success**: <how the actor achieves the goal across the system boundary>
- **Alternates/exceptions**: <only if one forces a boundary, a failure mode, or an entity; otherwise omit this line>

## Primary journey

<!-- The main end-to-end flow as numbered steps (the daily loop) stringing the use
     cases together. Note the anchor view or background job at each step. -->
1. {Step} - <anchor view / job involved>

## Acceptance signals

<!-- For the key use cases: one line each on how you would know the architecture
     supports it. Descriptive checks, not SHALL specs. Where a quality attribute
     from the proposal bears on a use case, state the check against it here. -->
- {Use case}: <the question the design must answer "yes" to>
