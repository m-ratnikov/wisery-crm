## 0. Cross-view consistency check

- [x] 0.1 Every container in the L2 diagram (browser, app, managed Postgres) and every participant in the two runtime flows - including the spawned headless-browser child (L3), the provider, and the LLM - is consistent across the container view and the sequence diagrams; no participant is absent from the container view and no orphan box exists.
- [x] 0.2 The Intelligence-pipeline order (scan -> normalize at the edge -> dedup to Signals -> qualify/score gate -> deep-enrich the >= 3 -> draft from the dossier -> persist queued) matches the product-overview pipeline diagram (section 4) and D5; the score is the cost gate and the draft is a separate post-enrichment call.
- [x] 0.3 Every ADR cited in system-design.md (ADR-0001 accepted; ADR-0002/0003/0004) exists, and 0002/0003/0004 are moved to `accepted` (in section 3) before this view is promoted.
- [x] 0.4 `/verify-gate` has passed for system-design.md and ADR-0002/0003/0004: groundedness ledger has no unsupported claims, Chair verdict is not `rework`, the record's `git hash-object` matches current content, and human sign-off is recorded for the ADRs (docs/verification-gate.md). NOTE: the record is currently STALE - re-run after the scraper reclassification, the normalize/dedup pipeline fix, and the draft-after-enrich reorder.

## 1. Reconcile the spine (docs/product-overview.md)

- [x] 1.1 Cross-link the new container view (docs/architecture/system-design.md) from section 4 (the pipeline), and in section 9 note that the L2 container question (previously open) is now addressed.
- [x] 1.2 Confirm the locked-decisions table reads correctly after this change's reconciliations: D5 (qualify is the cost gate; the first-touch draft is a separate post-enrichment call, dossier-grounded), and the added D9 (LLM-agnostic via the `LLMProvider` port) and D10 (PII minimization attaches at the qualify boundary), each citing its ADR.

## 2. Distribute the views by scope

- [x] 2.1 Promote the C4 L2 container view + the two runtime flows from system-design.md to docs/architecture/system-design.md (NEW; flat at the top of the architecture folder, single implicit area, README rule 5). Strip every `<!-- v:... -->` anchor on the way (the clean canon view is generated from the anchored source, never hand-edited). Do NOT re-promote the reproduced C4 L1 section - it already lives in system-context.md. The "Decisions and trade-offs" section is NOT copied here; it lands as ADRs (section 3).
- [x] 2.2 Reconcile docs/architecture/cross-cutting.md: fold in only the L2-level mechanism detail the system-design surfaced that is not already there (observability via SQL views + no job UI, the secrets/trust containment, the failure-isolation specifics), stripping anchors; otherwise leave it unchanged.
- [x] 2.3 Reconcile docs/architecture/system-context.md (promoted L1): flip its "L2 not yet drawn" scope note into a link to the new system-design.md, and apply the L1 fixes this change surfaced - generalize the LLM box to provider-neutral (D9), correct the provider edge to return raw records (not "normalized"; we normalize at the edge), mark the draft-position open question (its line ~72) resolved as a separate post-enrichment call (D5), and widen the locked-decisions reference from D1-D8 to D1-D10.
- [x] 2.4 No promotion for domain-model.md (Skip - no entity changes), use-cases.md (not promoted; durable behavior becomes OpenSpec specs later), or deployment.md (out of scope per the proposal; it remains a non-promoted draft seed for a future deployment slice and archives with the change).

## 3. Promote ADRs

- [x] 3.1 Reconfirm the next free 4-digit ADR numbers against docs/adr/ (currently only 0001 is present), in case another change landed first.
- [x] 3.2 Promote adr/0002-self-hosted-scraping-separate-process.md (title: "Headless-browser scraping runs as an on-demand child process of the worker") to docs/adr/0002-...md and flip Status proposed -> accepted. Immutable thereafter.
- [x] 3.3 Promote adr/0003-llm-provider-port.md to docs/adr/0003-...md and flip Status proposed -> accepted.
- [x] 3.4 Promote adr/0004-pg-boss-facade.md to docs/adr/0004-...md and flip Status proposed -> accepted.

## 4. Cross-link

- [x] 4.1 Wire links: docs/product-overview.md section 4 -> docs/architecture/system-design.md; system-design.md -> its governing ADRs (0001/0002/0003/0004) and -> system-context.md; system-context.md -> system-design.md.
- [x] 4.2 Add docs/architecture/system-design.md to the docs/architecture/README.md index, and confirm the three newly promoted ADRs are cross-linked from the product-overview locked-decisions table (D9 already cites ADR-0003; add ADR-0002 and ADR-0004 where their decisions are referenced).
