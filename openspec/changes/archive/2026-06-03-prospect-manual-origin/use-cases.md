## Actors

- **CRM user (primary operating persona)**: a freelancer, solopreneur, developer, consultant, or other operator running their own outreach. Beyond configuring sources and working the queue, they sometimes already know a specific person they want in the pipeline and want to add that person by hand, then have the engine score and (optionally) draft for them like any other prospect.
- **Prospect (end recipient)**: the person added. For a manual lead their identity is entered first-hand by the CRM user (not scraped), but they are evaluated and acted on through the same pipeline and the same manual, ToS-safe action (D2).

## Use cases

### UC1: Add a known person to the pipeline by hand (CRM user)
- **Main success**: the CRM user opens the prospect list, enters a person's identity (at least a name, plus the fields needed to score and reach them), and the system creates a prospect with a manual origin and no signal, which then enters the pipeline and is scored against the active rubric like any signal-derived prospect.
- **Alternates/exceptions**: a manual lead may carry too little for a confident score - the qualifier's existing insufficient-data verdict (-1) applies unchanged, so a thin manual lead is handled by the same gate, not a new path. (Forces the entity: the manual lead must carry enough identity for the rubric to read.)

### UC2: Work a manual lead the same as any prospect (CRM user)
- **Main success**: once added, a manual-origin prospect appears in the prospect list and (if it qualifies and is drafted) the review queue, with its identity, score, and status shown the same way as a signal-derived prospect, so the CRM user has one list and one queue regardless of origin.

## Primary journey

1. The CRM user is working the prospect list and wants to add someone they already know - anchor view: prospect list.
2. They enter the person's identity and submit - anchor view: prospect list (an add-lead action).
3. The system creates a manual-origin prospect (no signal) and enqueues qualification - background job: qualify.
4. The qualifier scores the manual lead against the active rubric and gates at >= 3, exactly as for a signal-derived person - background job: qualify.
5. From here the prospect is indistinguishable in handling: optional enrich, draft, and the review/approve queue - background jobs + anchor view: review queue.
6. The CRM user acts manually and logs the outcome against the score - anchor view: review queue.

## Acceptance signals

- UC1: Can a prospect exist with no `signal_id`, while the model still forbids a signal-derived prospect from missing its signal? (Integrity quality attribute.)
- UC1: Can the qualifier read a manual lead's identity through the same path it reads a scraped person's, with no origin-specific branching beyond one read seam? (Consistency quality attribute.)
- UC2: Does the prospect list and the review queue render a manual-origin prospect with the same identity/score/status fields as a signal-derived one, with no per-origin code path in the read-models?
- UC1: Is the change additive for existing data - every current prospect remains signal-derived with its `signal_id` intact, no row rewritten? (Backward-compatibility quality attribute.)
