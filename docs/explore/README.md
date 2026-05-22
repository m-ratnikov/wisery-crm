# Explore notes

Investigations that back decisions - the research a lean ADR deliberately omits (rejected options, tradeoffs, sources). One note per investigation, dated, left as a snapshot (not immutable, but you don't keep editing it). Each note's outcome is distilled into an ADR in `../adr/`; the ADR links back here and this note links to the ADR.

Naming: `YYYY-MM-DD-topic.md`.

## Method

Adapted from GitHub spec-kit (MIT) - its `clarify` and `plan` Phase-0 research prompts - applied by hand with the tool-specific plumbing stripped. We do not install spec-kit.

**1. Frame.** State the question, plus assumptions and constraints.

**2. Clarify** - when the idea is still fuzzy, resolve ambiguity before researching. Scan across nine categories and mark each Clear / Partial / Missing:

| # | Category | Looks for |
|---|----------|-----------|
| 1 | Functional scope & behavior | goals, out-of-scope, personas |
| 2 | Domain & data model | entities, state transitions, scale |
| 3 | Interaction & UX flow | journeys, error states, accessibility |
| 4 | Non-functional attributes | performance, reliability, observability, security, compliance |
| 5 | Integrations & external deps | contracts, versioning, import/export |
| 6 | Edge cases & failure handling | negative paths, rate limits, conflicts |
| 7 | Constraints & tradeoffs | technical limits, rejected alternatives |
| 8 | Terminology & consistency | canonical glossary terms |
| 9 | Completion signals | testable acceptance criteria |

Then ask at most **5 questions**, highest **(Impact x Uncertainty)** first, one at a time. Each must be multiple-choice (2-5 options, with one recommended) or answerable in <=5 words. Stop when the criticals are resolved or after 5. Record the Q&A and fold answers into this note (and the proposal, when one exists).

**3. Research the unknowns.** Turn each open question into a research task. Ground in the installed docs first (per AGENTS.md), then the web. Prompt shape:
- `Research {unknown} for {our context}`
- `Find best practices for {tech} in {domain}`

**4. Consolidate** per option: Decision / Rationale / Alternatives, with tradeoffs and sources. Resolve every unknown before concluding.

**5. Distill** the outcome into an ADR (lean Nygard) in `../adr/`; cross-link the ADR and this note.

## Note skeleton

```
# Explore: {topic}

- Date: YYYY-MM-DD
- Decision: ../adr/NNNN-title.md (status)
- Method: spec-kit (clarify + research), adapted

## Question
## Assumptions and constraints
## Clarifications        (Q&A from the clarify pass, if any)
## Unknowns              (NC1, NC2, ...)
## Options considered    (per option: pros/cons, tradeoffs)
## Key findings          (grounded; note where each came from)
## Outcome               (which option; pointer to the ADR)
## Sources
```
