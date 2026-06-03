## 1. Schema and migration

- [x] 1.1 Add the `outcome_result` pg enum (`connected | replied | booked | no_response`) and the `outcomes` table to `src/lib/db/schema.ts`: uuid PK, `prospect_id` FK -> prospects RESTRICT, `draft_id` FK -> drafts RESTRICT nullable, `score_at_time` smallint NOT NULL, `result` outcome_result NOT NULL, `channel` text NOT NULL, `notes` text nullable, `occurred_at` timestamptz default now, `created_at`; index on `prospect_id` (D-A)
- [x] 1.2 `npm run db:generate`; review the migration (table, enum, nullable draft FK, index); confirm ordered after 0006; `npm run db:migrate`

## 2. The queue read-model

- [x] 2.1 Create `src/lib/queue/read.ts` (`server-only`) `listQueue()`: the prospects with open work (`queued` + `acted`) with name (from the signal payload), latest score + reason, selected draft body, and a dossier-exists flag; composed from small queries reusing `prospectsWithSignal()` (D-B)

## 3. The disposition transitions

- [x] 3.1 Create `src/lib/queue/transitions.ts` (`server-only`): `actProspect(id)` (`queued -> acted`, no-op otherwise) and `dismissProspect(id)` (`queued -> dismissed`, no-op otherwise) (D-C, D2)
- [x] 3.2 `logOutcome(id, { result, notes? })`: in one transaction, the conditional UPDATE `acted -> closed` (`WHERE status = 'acted'`) is the atomic single-winner claim (one `Outcome` under a double-submit); the winner inserts an `Outcome` (`score_at_time` = latest score, `draft_id` = selected draft or null, `result`, `channel`, `notes`); no-op if not `acted`; a missing scoring throws (D-C, D7)

## 4. The wired anchor view

- [x] 4.1 Create `src/app/review-queue/page.tsx` (Server Component): render a card per `listQueue()` item - score, dossier (if any), selected draft, an assisted-action deep link, and act / dismiss / log-outcome controls valid for the disposition; adapt the prototype components (D-D)
- [x] 4.2 Create `src/app/review-queue/actions.ts` (`'use server'`): `actAction`, `dismissAction`, `logOutcomeAction` wrapping the transitions + `revalidatePath`; add the D1 auth-deferred note (D-D)

## 5. Tests

- [x] 5.1 Integration test (gated): `listQueue()` returns a drafted+queued prospect with its selected draft body and latest score; a non-queued prospect is absent
- [x] 5.2 Integration test: `actProspect` moves `queued -> acted`; `dismissProspect` moves `queued -> dismissed`; both no-op on a prospect not queued
- [x] 5.3 Integration test: `logOutcome` on an acted prospect writes an `Outcome` with the correct `score_at_time` (the latest score) and `draft_id` (the selected draft), and moves it `acted -> closed`; it no-ops on a non-acted prospect

## 6. Verify, registry, archive

- [x] 6.1 Cover `src/lib/queue/**` via the integration tests; `src/app/**` route + actions are coverage-excluded
- [x] 6.2 Update `src/app/prototype/README.md`: mark the `review-queue` screen graduated to the wired anchor view
- [x] 6.3 Run `npm run verify` green against a reachable test Postgres
- [x] 6.4 Re-review the delta in context (READ-ONLY agent) per the looping rule, then `/opsx:verify` and archive
