# Explore + implementation plan: optimizing how we ship features

- Date: 2026-06-13
- Status: plan ready to execute (not yet applied)
- Method: retrospective on the `remove-person-scoring` + `adr-signal-only-scoring` session, then a process design
- Audience: a fresh session executing this plan with no prior conversation context. Read this whole note first, then `openspec/config.yaml`, `CLAUDE.md`, `docs/architecture/README.md`, and `docs/verification-gate.md` before editing.

## Why (the problem)

Shipping `remove-person-scoring` took far more effort in paperwork than in code. The code was small (drop a table + column, delete one slice, relocate a scorer, fix tests, one migration). Around it we paid: a separate code-less architecture change, a 7-artifact `spec-driven-architecture` cascade, a full `verify-gate` (3 ledger agents + 4-agent panel + chair + re-rounds), and a by-hand re-slice of six canon docs. The architecture change produced **no code**.

Two root causes:

1. **The same fact is written in many docs.** The single fact "a person has a score" lived in `product-overview.md` (D5/D7/D12), `glossary.md`, `domain-model.md` (entity + lifecycle + events), `system-design.md` (L3 catalog + flows), and `cross-cutting.md`. Removing it meant editing the same idea in ~6 places by hand, with ~6 chances to drift - which is *why* the heavy review exists (to catch that drift). The review is largely compensating for the docs' own duplication.
2. **The heaviest review runs for every architectural change.** The adversarial panel is right for a contested, irreversible decision (it caught a real overclaim this session - a doc called `signal_advisory` "durable" when it is a mutable hint). It is overkill for "delete the thing we already agreed to delete."

## Current setup (facts to ground edits)

- **Schemas** live in `openspec/schemas/`. Discovery keys on a file literally named `schema.yaml`.
  - `spec-driven` (built-in, not a folder here): `proposal -> specs -> design -> tasks`. Code changes, no ADR. This is the project default (`openspec/config.yaml` `schema: spec-driven`).
  - `spec-driven-architecture/schema.yaml` (ACTIVE): `proposal -> use-cases -> domain-model -> system-design -> deployment -> adr -> tasks`. Heavy. Drafts ADRs + promotes views into `docs/architecture/`. Triggers `verify-gate`.
  - `spec-driven-with-adr/schema.yaml.disabled` (PARKED): `proposal -> specs -> design -> adr -> tasks` - i.e. the normal code schema plus one `adr` step that writes straight to `docs/adr/*.md`. No C4 views, no descriptive-canon re-slice. Parked 2026-05-21 (see `docs/explore/2026-05-21-architecture-folder-organization.md` and that schema's `README.md`) on an organizational-purity call ("ADRs owned solely by spec-driven-architecture"), made before anyone felt the cost.
- **Latent inconsistency:** `CLAUDE.md` "Capture conventions" already says ADRs are recorded "via the `spec-driven-with-adr` schema", while `openspec/config.yaml` and the schema README say that schema is parked and ADRs come via `spec-driven-architecture`. Restoring the middle schema reconciles this.
- **Living canon** = `docs/product-overview.md` (spine) + `docs/architecture/*` + `docs/adr/*`. Organized by SCOPE (per `docs/architecture/README.md` and the 2026-05-21 note): system-wide files (`glossary.md`, `system-context.md`, `cross-cutting.md`) have exactly one copy; per-area deep views live under `areas/<area>/` (currently flat - one implicit area).
- **canon-integrity** (`tests/canon-integrity.test.ts` against `docs/architecture/canon.manifest.json`, run by `npm run verify`) enforces: required section headings present, no leaked `<!-- v:... -->` anchors, no references to archive-only artifacts, all canon links resolve. Required sections that MUST survive any dedup:
  - `product-overview.md`: Personas, Primary journey, Locked decisions, Pipeline architecture, MVP scope, Open questions
  - `system-context.md`: Boundary runtime flow
  - `system-design.md`: Containers, Key runtime flows, Components (C4 L3)
  - `domain-model.md`: Entity model, Lifecycle, Domain events
  - `README.md`: Layout, Rules, Canon integrity
- **Reconciliation tool that already exists:** `docs/system-review.md` (the `/system-review` skill) - a whole-system code review at milestone/convergence. This is the natural place to batch-reconcile canon drift.
- **verify-gate** (`docs/verification-gate.md`): already classifies high- vs low-stakes; human sign-off mandatory for ADRs/immutable-canon. Panel lineups are per-artifact.

## Decisions (already settled with the owner - do not re-litigate)

The six options discussed collapsed to three must-haves plus one drop:

- **A. Three tiers + proportional gate + restore the middle schema** (was points 1, 2, 6 - one bundle).
- **B. De-duplicate the canon to one authoritative home per fact** (was point 3 - the structural fix the owner specifically wants).
- **C. Reconciliation guardrail** (was point 4): the lighter tiers must declare canon impact, and `system-review` batch-reconciles. C ships WITH A - A alone trades time-cost for drift-cost; C is what keeps the docs honest.
- **DROP. Automating the re-slice** (was point 5) - if B succeeds there is little left to re-slice. Revisit only if needed.

The three tiers and their triggers:

| Tier | Schema | Use when | Review |
|---|---|---|---|
| 1 mechanical | `spec-driven` | reversible, no durable decision: bugfix, rename, copy fix, dead-code removal, a tweak inside existing architecture | `npm run verify` + `code-review` on the diff |
| 2 durable-but-clear | `spec-driven-with-adr` | a durable decision that fits an ADR + code, does NOT need C4 views, and does NOT supersede a still-load-bearing accepted ADR | the above + `/verify-gate` on the ADR ONLY if it supersedes an in-force ADR; otherwise a light check (ledger + one `canon` reviewer) |
| 3 contested/complex | `spec-driven-architecture` | a contested or complex decision where the C4 views do real analytical work, OR that supersedes a load-bearing ADR, OR drops/migrates data structurally | full `verify-gate` panel + canon promotion |

Tier-3 trigger, concretely: "supersedes an accepted ADR that is still in force, OR drops/reshapes persisted data, OR introduces a new entity/boundary/port that future changes will be constrained by, OR the owner flags it contested." `remove-person-scoring` was correctly Tier 3. The `reframe-auto-enrich-routing` cleanup was Tier 2 at most; the auto-enrich nicety would have been Tier 1.

## Implementation plan

Two phases. Phase 1 (A + C) is config + convention, low risk, do first. Phase 2 (B) is a structural docs refactor, more care, do second. Each phase ends green on `npm run verify`.

### Phase 1 - Restore the middle tier + write the tiering rule + the guardrail (A + C)

This is a tooling/process/docs change. Per the standing convention (`MEMORY.md`: "Framework changes skip OPSX flow"), edit directly - do NOT route Phase 1 through an OpenSpec change.

1. **Re-enable the middle schema.** Rename so the CLI discovers it:
   `mv openspec/schemas/spec-driven-with-adr/schema.yaml.disabled openspec/schemas/spec-driven-with-adr/schema.yaml`
   Verify: `openspec schemas` now lists `spec-driven-with-adr`.
2. **Rewrite that schema's `README.md`** (currently titled "Parked schema - DISABLED"). New content: it is the **Tier-2** schema - code + spec deltas + an ADR in one change, for durable-but-uncontested decisions; no C4 views, no descriptive-canon re-slice. State that the ADR step MUST include a "Canon impact" line (see step 5). Point to this note and to `CLAUDE.md` for the tier rule.
3. **Update `openspec/config.yaml`'s top comment** (the block above `schema: spec-driven`). Replace the "parked / no longer the default" paragraph with the three-tier model: `spec-driven` stays the default for Tier 1; `spec-driven-with-adr` is selectable via `--schema` for Tier 2; `spec-driven-architecture` via `--schema` for Tier 3. Keep `schema: spec-driven` as the default. Add to the `design` rules block: a Tier-2 change MAY carry its own `adr` step (so the existing "this schema has no adr step; record a superseding ADR via a spec-driven-architecture change" rule is relaxed to "via a spec-driven-with-adr or spec-driven-architecture change").
4. **Write the tier rule into `CLAUDE.md` "Spec workflow" section.** Replace the current two-line section with the three-tier table above (tier, schema, trigger, review) plus the concrete Tier-3 trigger sentence. Reconcile the "Capture conventions" bullet (line ~44) so it agrees: ADRs are recorded via `spec-driven-with-adr` (Tier 2) or `spec-driven-architecture` (Tier 3), both immutable, both promote to `docs/adr/`.
5. **Add the Canon-impact guardrail (C).** Two edits:
   - In the `spec-driven-with-adr` schema's `adr` artifact instruction (in `schema.yaml`), require a one-line **"Canon impact"** field in each ADR: name the `docs/architecture/*` / `docs/product-overview.md` sections this decision makes stale (or "none"). The Tier-2 schema does NOT re-slice those docs synchronously - it only writes the ADR.
   - In `docs/system-review.md`, add a step: a system-review run reconciles the canon docs named in the "Canon impact" lines of ADRs accepted since the last review (then clears the backlog). This is what keeps Tier 2 honest.
6. **Make the gate proportional (part of A).** In `docs/verification-gate.md`, add a short "Proportionality" note: the full panel (atlas + greybeard + pedant + canon + chair) runs for Tier-3 artifacts and for any ADR that supersedes an in-force ADR; a Tier-2 ADR that supersedes nothing gets Stage-1 ledger + a single `canon` reviewer + human sign-off, not the full panel. (Human sign-off on any ADR stays mandatory.)
7. **Verify Phase 1:** `openspec schemas` lists all three; `npm run verify` green (it does not test schemas, but confirms no doc/test broke); optionally `openspec new change --schema spec-driven-with-adr _smoke` then delete the folder to confirm the artifact graph loads.

### Phase 2 - De-duplicate the canon (B)

Goal: each fact has ONE owning doc; other docs link to it instead of restating it. Then a concept change is 1-2 edits, not 6, and there is little left to drift. This is a docs refactor: capture reasoning in THIS note (extend it), edit the canon directly, gate on `npm run verify` (canon-integrity). Do NOT delete any required section heading (see the manifest list above). Consider writing a short companion explore note if the audit gets large.

Ownership model to apply (one home per kind of fact):

- **`glossary.md`** owns each term's definition. Everywhere else uses the term and links to the glossary instead of re-defining it.
- **`domain-model.md`** owns entities, their fields, relationships, lifecycle, and domain events. Other docs reference an entity by name; they do not restate its fields or its lifecycle.
- **`system-design.md`** owns components (C4 L3), containers, and runtime flows. Other docs link to a flow; they do not redraw it.
- **`system-context.md`** owns the L1 boundary and the boundary runtime flow.
- **`cross-cutting.md`** owns observability/secrets/trust/data-sensitivity/scaling/learning-loop notes.
- **`product-overview.md`** is the SPINE: north-star, the Locked-decisions table (one row per decision, each linking to its ADR - it states the decision and why, and links the ADR; it must NOT restate entity/lifecycle/flow detail the area docs own), Personas, Primary journey, Pipeline architecture (one diagram), MVP scope, Open questions. Where it currently restates a definition or an entity shape, cut to a one-line summary + link.
- **`docs/adr/*`** own decisions (immutable). Other docs cite the ADR number; they do not paraphrase its reasoning at length.

Method (per concept):

1. **Inventory the worst repeated facts.** Start from the known hotspots and grep for each across `docs/`:
   - the entity/score model (the just-removed "score" debt is the worked example of the cost),
   - the pipeline/status model (`pipeline_status`, "configurable pipeline"),
   - the triage/approval flow (described in product-overview, domain-model events, system-design flows, glossary Queue),
   - the on-demand-actions model (generation/enrich), and the Draft/drafting retirement (note: there is KNOWN stale drafting debt - `openspec/specs/drafting/spec.md` and the `prospect-list` spec Purpose still mention drafts/scores; fold this cleanup in).
2. **Pick the owner** per the model above.
3. **Reduce the non-owners** to a one-line reference + link (e.g. product-overview's nouns paragraph becomes "Canonical nouns are defined in [glossary.md]; the entity model and lifecycle in [domain-model.md]").
4. **Re-run `npm run verify`** after each doc; fix any canon-integrity failure (missing required section, broken link, leaked anchor) by restoring the section/link, not by editing the test.
5. **Spot-check the win:** pick one concept (e.g. "score") and confirm it now has exactly one substantive description, with links from elsewhere.

Acceptance for Phase 2: a representative concept is described once; `npm run verify` green; the `product-overview.md` Locked-decisions table links ADRs rather than paraphrasing them; the stale drafting/score references in `openspec/specs/` and canon are gone or reduced to links.

## Gotchas learned this session (carry into execution)

- **OpenSpec archive can leave partial spec writes on abort.** Archiving a change with several spec deltas: if one capability fails validation mid-merge, the CLI may already have written earlier capability specs before printing "Aborted. No files were changed." Recovery: `git checkout HEAD -- openspec/specs/` then fix the failing delta and re-archive. Inspect `git status openspec/specs/` after any aborted archive.
- **Retiring a whole capability** (all its requirements REMOVED) yields an empty spec, which fails validation ("Spec must have at least one requirement"). Resolution: delete the canonical capability dir (`openspec/specs/<cap>/`) AND drop its delta from the change so the archive does not try to rebuild it; record the retirement in the proposal + ADR. (This is how `qualification` was retired.)
- **Mermaid sequence-diagram labels must not contain `;`** - a semicolon terminates the statement and the parser errors. Use `,` or ` - `. After editing ANY diagram in `docs/` or a change, run `npx vitest run tests/mermaid.test.ts`.
- **ADRs are immutable once accepted.** Never edit an accepted `docs/adr/*`. The supersession lives in the NEW ADR's header (Supersedes: ADR-NNNN); consumers walk those links. Phase 2 must not "tidy" old ADR bodies.
- **canon-integrity forbids leaked `<!-- v:... -->` anchors** (the verification anchors used in change drafts). Clean canon never carries them; strip on promotion.

## Sequencing summary

1. Phase 1 (A + C) - direct edits, ~1 sitting, the immediate >50% overhead cut. Verify: `openspec schemas` + `npm run verify`.
2. Phase 2 (B) - the structural payoff; do deliberately, gate each doc on `npm run verify`. Fold in the known drafting/score staleness.
3. Skip point 5 (automation) unless B leaves enough re-slicing to be worth scripting.

## Sources

- This session's `remove-person-scoring` + `adr-signal-only-scoring` execution and `verify-gate` run.
- `docs/explore/2026-05-21-architecture-folder-organization.md` (the canon layout + the original parking of `spec-driven-with-adr`).
- `openspec/config.yaml`, `CLAUDE.md`, `docs/architecture/README.md`, `docs/architecture/canon.manifest.json`, `docs/verification-gate.md`, `docs/system-review.md`, `openspec/schemas/spec-driven-with-adr/`.
