# Wisery CRM - MVP build roadmap

Status: Draft, captured 2026-05-25.

The sequenced build plan for the MVP. It decomposes the locked scope in
[product-overview.md](product-overview.md) section 8 into discrete capabilities (each a future
OpenSpec change) and orders them. This is a derivation of decisions already locked (D1-D10, the
pipeline in product-overview section 4, the C4 L2 containers in
[architecture/system-design.md](architecture/system-design.md)) - not new scope. When scope and this
roadmap disagree, the product overview wins and this doc is updated.

## Where we are

- **M0 - Backbone (DONE).** `platform-runtime` + `background-jobs`: config, pooled Postgres, logging,
  pg-boss in-process, graceful drain. Both promoted to canonical specs under `openspec/specs/`.

The data layer itself is still unbuilt: the backbone left `src/lib/db/schema.ts` empty with zero
migrations. The archived `initial-db-schema` change (2026-05-21) *specified* a `signal-ingestion`
capability (sources / scans / signals + the connector contract) but it was never implemented and
never promoted - so the first feature change below picks that spec up.

## The MVP capability set

Each row is one future OpenSpec change on the default `spec-driven` (code) schema. "Kind" is what the
change mainly produces.

| # | Capability (change) | Kind | What it adds | Locked by | Depends on |
|---|---|---|---|---|---|
| 0 | **quality-harness** | tooling | ESLint (type-aware) + formatter + Vitest coverage thresholds + dependency-cruiser architectural-boundary rules + a single `verify` script + GitHub Actions CI; the `code-review` skill run per change | this decision (2026-05-25) | M0 |
| 1 | **signal-ingestion** | data + port | `sources` / `scans` / `signals` tables, `SignalSource` connector contract (normalize-at-edge), dedup -> Signal, one scan job per Source | D4, D8, ADR-0004 + archived spec | M0 |
| 2 | **llm-provider** | port | `LLMProvider` port + Anthropic Structured Outputs adapter, Zod validation, prompt-version + 1h cache | D9, ADR-0003 | M0 |
| 3 | **icp-config** | anchor view + data | ICP rubric + user profile as config-as-data; the config UI (anchor view #1) | D6, D1 | signal-ingestion |
| 4 | **source-adapters** (person-first) | adapter | First concrete `SignalSource`(s): LinkedIn search and/or X (person-yielding, no expand layer) | D8 | signal-ingestion |
| 5 | **qualification** | job + data | Ported 1-5 ICP scorer, score gate (>= 3), prospect fan-out (one signal -> N people), score persistence, anti-hallucination | D5, D7 | llm-provider, icp-config |
| 6 | **enrichment** | port + job + data | `EnrichmentProvider` port + Apify deep-enrich (gated by qualify), builds the dossier | D4, D10 | qualification |
| 7 | **drafting** | job + data | Personalized first-touch draft from dossier + profile (separate LLM call after enrich) | D5 | llm-provider, qualification |
| 8 | **review-queue** | anchor view + data | Approve queue (anchor view #2): queued prospect + dossier + draft; assisted-action deep link; outcome logging against score | A1+A3, D2, D7 | drafting |
| 9 | **prospect-list** | anchor view | Lead / prospect list (anchor view #3): browse + manage prospects and signals | thesis | qualification |
| 10 | **normalize-expand** | job | company / content -> people (firmographic pre-check + title-filtered expansion); unlocks CSV / company / news sources | section 4 cost gate | enrichment |

Anchor views (the only hand-built UI, per the thesis): **icp-config** (#1), **review-queue** (#2),
**prospect-list** (#3). Everything else is background jobs and generative output.

## Sequencing

### M1 - First walking product

One person source, end to end, human in the loop:

```
quality-harness -> signal-ingestion -> llm-provider -> icp-config
  -> source-adapters(person) -> qualification -> drafting -> review-queue
```

Outcome: configure an ICP + a LinkedIn/X source, run a scan, get scored and drafted prospects in a
queue, act manually, log the outcome. The entire thesis, thin.

**`quality-harness` lands first (step 0):** it stands up the gates every later change must pass and is
proven green against the existing backbone before any feature code is written. `signal-ingestion` and
`llm-provider` have no dependency on each other and can be built in either order or in parallel.
**review-queue carries outcome logging from day one (D7)** - the learning loop is the differentiator,
so it is not deferred.

### M2 - Thicken and broaden

```
enrichment -> normalize-expand -> prospect-list -> more source adapters
```

### Deferred (post-MVP, per product-overview section 8)

Outcome-driven tuning of the precision bar (data accrues now per D7); the content surface
(post / carousel) and bidding surface; the email channel (`EmailSender` is designed, not built); all
multi-tenant plumbing (overview section 7); autonomous / automated sending (never, D2).

## Open sequencing decisions

- **Enrichment placement (M1 vs M2). RESOLVED** by [ADR-0007](adr/0007-user-triggered-optional-enrichment.md)
  (2026-06-01): enrichment is in M1 but **optional and user-triggered by default**, not an automatic
  pre-draft stage. **Refined by [ADR-0019](adr/0019-generation-and-scoring-on-demand.md)
  (2026-06-08, engagement-rework):** the drafting stage is removed entirely - first-touch generation
  and re-scoring are on-demand Person actions (approval promotes the advisory score into an initial
  Scoring, no auto-qualify), and the opt-in auto-enrich-on-qualify setting is withdrawn; enrichment
  stays optional and user-triggered, now from the Person workspace. The signal-level score still acts
  as the cost gate (the advisory hint), resolving the D5 tension.
- **Source shipping order beyond the first two person adapters** (product-overview open question).
- **Whether `icp-config`'s anchor UI lags a seeded config** - qualification can start against a config
  seeded from `job-monitor`'s `ICP_SYSTEM_PROMPT` before the editing UI exists.

## Verification posture

Every capability here is verified by the **`quality-harness` gates** (`verify` = `tsc` + ESLint +
duplication/code-smell + per-file coverage + dependency-cruiser boundaries + `next build`, enforced in
CI). These gates run whole-tree, so they catch system-context regressions, not just per-diff issues.
On top of the gates, two judgment cadences: **per change**, `/opsx:verify` (conformance to design +
ADRs) plus a `code-review` pass run with architecture context; **per milestone**, a whole-system
review over the accumulated code to catch drift no single change reveals. This is the `spec-driven`
code schema and is **not** the multi-agent architecture verification gate
([verification-gate.md](verification-gate.md)), which only re-fires if a change introduces a *new*
architectural seam (for example, the email-channel container when that lands) - a
`spec-driven-architecture` change first. `quality-harness` (change #0) is what stands these gates up.
