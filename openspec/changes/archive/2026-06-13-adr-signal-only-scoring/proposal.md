## Why

ADR-0019 settled person scoring as promotion-at-approval plus on-demand re-score, with qualification as a derived read (ADR-0020). The owner now rejects person scoring altogether: the advisory score on the signal already carries the judgment, the human's approve/dismiss verdict IS the gate, and a second person-keyed scoring system (table, LLM pipeline, prompt, provenance convention, derived qualification) re-asserts a decision already made. This change records the architectural decision that the signal is the only scored thing in the system. Provenance: the owner directive of 2026-06-12; companion code change `remove-person-scoring`.

## Scope

**In:**
- Retire person scoring entirely: the `scorings` entity, the approval-promotion write, the on-demand re-score action, the `advisory | llm` provenance convention, and the derived Qualification read (qualified / below_bar / unassessed).
- `signal_advisory` becomes the single scoring concept; rubrics keep all three kinds as its config.
- Drop `outcomes.score_at_time`; re-state D7 as a deferred learning loop to be redesigned over signal advisory data.
- Supersede ADR-0019 in part and narrow ADR-0020 and ADR-0005 accordingly.

**Out:**
- Designing the advisory-based learning loop (deferred to its own explore + ADR; this change only removes the per-person binding).
- Any change to the advisory filter, rubric versioning/seeding, triage flow, pipelines, messages, or enrichment.
- The code/migration work itself (the companion `spec-driven` change `remove-person-scoring` ships it; the two land together).

## Views

- `use-cases`: Required - the People list, person detail, and Person workspace lose the score/qualification surface; the actor's qualification act moves wholly to triage.
- `domain-model`: Required - the SCORING entity is removed, OUTCOME loses its score snapshot, and the Qualification derived read disappears from the model.
- `system-design`: Required - the on-demand re-score runtime flow and the approval-promotion sub-step are removed; the LLM port loses one consumer.
- `deployment`: Skip - where-things-run is unchanged; the only operational artifact is one destructive Drizzle migration owned by the companion code change.

## Quality attributes

- **Cost control**: completes ADR-0019's trajectory - exactly one LLM scoring pass exists (the per-signal advisory filter); no code path can spend LLM budget scoring a person.
- **Simplicity / minimal interface**: one score concept, one place (the signal at triage); People surfaces carry pipeline status only. Removes a whole judgment-duplicating subsystem rather than maintaining its integrity rules (the provenance exclusion becomes unnecessary instead of enforced).
- **Data**: the drop is destructive by intent (pre-launch dev data, no preservation); migrations stay immutable - removal is one new forward-only migration.
- **Learning-loop integrity (D7)**: preserved vacuously - with no person score and no `score_at_time`, nothing can train on the cheap pass; the future loop binds to `signal_advisory` rows, which remain durable.

## Impact on canon

- Overview sections (docs/product-overview.md): the **Locked decisions** table (the D5 scorer row and the ADR-0019 scoring rows re-stated as signal-only advisory scoring; the D7 row reworded to a deferred advisory-based loop); section 4 **Pipeline architecture** (remove the re-score action and the qualification read from the post-intake picture); section 8 **MVP scope**; section 9 **Open questions** (open: the shape of the advisory-based learning loop).
- System-wide views: docs/architecture/glossary.md (remove Scoring, Qualification, provenance; sharpen Advisory score as the only score); docs/architecture/cross-cutting.md (the D7 learning-loop note rewritten to the deferred advisory-based design; the provenance-exclusion invariant deleted as moot).
- Area views (flat canon, single implicit area): docs/architecture/domain-model.md (remove the SCORING entity, its relationships and events, the Qualification derived read, and OUTCOME.score_at_time) and docs/architecture/system-design.md (remove the re-score flow and the approval-promotion sub-step from key runtime flows; the qualify component leaves the C4 L3 view).
- ADRs: **0022** Signal advisory is the only score - person scoring removed (supersedes ADR-0019 in part [the two person-scoring triggers, the `scorings.provenance` convention, qualification-as-read]; narrows ADR-0020 [its "qualification leaves status" decision ends in removal, the pipeline model stands] and ADR-0005 [the per-person Scoring mandate is withdrawn; the one-to-many fan-out stands]; ADR-0017's advisory rubrics stand, their no-pollution purpose now satisfied trivially).
