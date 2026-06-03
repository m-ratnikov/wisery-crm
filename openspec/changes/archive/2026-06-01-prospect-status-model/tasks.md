## 1. Promote the ADR

- [x] 1.1 Copy `adr/0008-prospect-status-is-disposition.md` to `docs/adr/0008-prospect-status-is-disposition.md`

## 2. Promote the domain-model revision

- [x] 2.1 In `docs/architecture/domain-model.md`, update the `PROSPECT` entity `status` comment to the 7-value disposition set (`new, below_bar, qualified, queued, acted, dismissed, closed`); note that enriched/drafted are derived from the DOSSIER/DRAFT relations
- [x] 2.2 Replace the Prospect lifecycle state diagram with the disposition-only version (New -> BelowBar/Qualified directly; Qualified -> Queued; no Enriched/Drafted/Scored states)
- [x] 2.3 Update the lifecycle prose and the domain-events table (ProspectEnriched/DraftGenerated set no status; scoring goes New -> Qualified/BelowBar; drafting moves Qualified -> Queued), referencing ADR-0008

## 3. Code conformance

- [x] 3.1 In `src/lib/qualify/status.ts`, drop `scored` from `prospectStatusSchema` (`["new", "below_bar", "qualified"]` - the subset this capability uses); `gateStatus` is unchanged (returns qualified/below_bar). Confirm no code sets `scored`

## 4. Verify, re-review, archive

- [x] 4.1 `npm run verify` green (the status.ts edit + all tests); confirm mermaid/arch-links/canon-integrity pass with the revised diagram and the new ADR link
- [x] 4.2 Re-review the delta in context (the lifecycle revision + the enum edit) per the looping-review rule
- [x] 4.3 `/opsx:verify` and archive --skip-specs (architecture change, no spec deltas)
