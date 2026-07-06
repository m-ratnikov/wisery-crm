# Anchor-view prototype (clickable wireframes)

One evolving low-fi clickable app for designing the product's hand-built UI before it is
wired. It runs on the real Next 16 / Tailwind 4 stack with **mock data** (no `db`, no `jobs`,
no `src/lib` imports), so a settled screen graduates straight into a wired `(anchor)` view by
swapping its mock `_data` for real reads.

- **Is**: interactive wireframes to settle UX (layout, affordances, flow) before building.
- **Is not**: production code, architecture canon, or anything that sends. The human always
  acts manually (D2).

## Registry (the join table)

> **Keep this current.** When you add, rename, or graduate a screen, update the table below and its
> status. This registry is the join table the architecture docs and capability specs point at, so a
> stale row silently breaks the linking model. No build gate enforces this - it is a maintenance
> rule (see `CLAUDE.md`, Project rules).

A screen is a UX surface; a capability is product behavior; an L3 component is structure.
They do **not** map one-to-one - a single screen surfaces several capabilities (a view
integrates the outputs of background capabilities), and a capability can appear on several
screens. This table is the source of truth for those many-to-many relationships.

| Screen | Route | Status | Owning view (C4 L3) / anchor | Capabilities surfaced | Explore note |
|---|---|---|---|---|---|
| Queue | `/prototype/queue` | sketch | "The unified Queue", anchor - the sole intake. Universal signal triage: see a signal's details with its advisory score (the only score in the system, ADR-0022), then approve (routes by kind to a Person / Company / peer-author + Post, entity only - no score written) or dismiss. Keyboard triage (A/D/J/K). Replaces the superseded "Review & approve queue" (the drafting stage is gone, ADR-0019). | triage (signal/decision), advisory-filter (advisory hint), signal-ingestion (source/signal) | [engagement rework](../../../docs/explore/2026-06-08-engagement-rework-queue-pipelines-messages.md) |
| People & companies | `/prototype/people` | sketch | "Person list", anchor - browse/manage surface and the index into the detail pages. Tabs for People (prospect/peer, pipeline status, monitored - no score or qualification, ADR-0022) and Companies. | person-list (prospect-list), pipeline (status), company | [engagement rework](../../../docs/explore/2026-06-08-engagement-rework-queue-pipelines-messages.md) |
| Person workspace | `/prototype/people/[id]` | sketch | "Person workspace", anchor - where a person is worked after intake. On-demand actions (enrich, generate Message/Comment), configurable pipeline status, monitored toggle, dossier, messages, engagement posts, outcomes (no score snapshot, ADR-0022). | enrichment (dossier), message-generation, comment-generation, pipeline (status), tracking (outcome) | [engagement rework](../../../docs/explore/2026-06-08-engagement-rework-queue-pipelines-messages.md) |
| Company detail | `/prototype/companies/[id]` | sketch | "Company detail" - first-class Company (ADR-0016); fit is the company signal's advisory score (ADR-0022), firmographics, deferred expansion to people. | company, advisory-filter | [engagement rework](../../../docs/explore/2026-06-08-engagement-rework-queue-pipelines-messages.md) |
| Feed | `/prototype/feed` | sketch | "The Feed", anchor - the engagement analog of the Queue. Posts from monitored people; generate, edit, and mark-posted AI comments grounded in the global comment guidance (the human posts by hand, D2). | feed (posts), comment-generation, comment-guidance | [engagement rework](../../../docs/explore/2026-06-08-engagement-rework-queue-pipelines-messages.md) |
| ICP & source config | `/prototype/icp-config` | graduated | "ICP and source config", anchor - **wired live at `/icp-config`** (Server Component + Server Actions over `src/lib/icp`); this prototype screen stays the design reference | icp-config (rubric + profile, config-as-data), source-adapters (source config), signal-ingestion (scan status) | [anchor-view wireframes](../../../docs/explore/2026-05-26-anchor-view-wireframes.md) |
| Whole-app shell | `/prototype` | sketch | integration flow -> [Primary journey](../../../docs/product-overview.md#primary-journey) | all anchor views (the daily loop + deep links) + live pipeline activity | [anchor-view wireframes](../../../docs/explore/2026-05-26-anchor-view-wireframes.md) |
| Settings | `/prototype/settings` | sketch | plumbing (not an anchor) | account; source-adapters (connected scrapers, read-only in MVP, V2-expandable) | - |
| Background jobs monitor | `/jobs` | wired (built directly, no prototype) | Operations view (not an anchor) - read-only observability of the in-process pg-boss pipeline | job-activity-monitor, scan-run-history (recent scan outcomes), background-jobs (activity introspection), app-shell (operations nav) | - |
| Sign in | `/prototype/sign-in` | sketch | plumbing (not an anchor) | auth (email/password; Google SSO is V2) | - |
| Sign up | `/prototype/sign-up` | sketch | plumbing (not an anchor) | auth (email/password; Google SSO is V2) | - |

**Status lifecycle**: `sketch` -> `in-review` -> `locked` -> `graduated` (wired into `(anchor)`).

**Anchor views vs plumbing.** After the engagement rework the hand-built *anchor* views are ICP
config, the unified Queue, the People list + Person workspace, and the Feed (product-overview
section 4). Settings and auth are standard plumbing UI - real, hand-built screens, but not anchor
views and not generative. They are listed here because they are part of the clickable app.

**Operations views skip the prototype.** A read-only observability surface (the jobs monitor)
has low layout ambiguity and no high-judgment action, so it is built directly as a wired screen
without a prototype mockup. It is still registered here so the capability spec -> screen link
resolves; it is neither an anchor view nor generative.

**Routing.** The signed-in app screens live under the `(app)/` route group (its `layout.tsx`
owns the sidebar chrome; `_data/` and `_components/` live there too). The auth screens
(`sign-in`, `sign-up`) sit at the `prototype/` root so they render full-bleed with no sidebar;
their shared chrome is in `_auth/`. Route groups do not change URLs, so `/prototype`,
`/prototype/icp-config`, etc. are unchanged.

**People-first MVP.** Person scrapers (LinkedIn, X) are the cheapest first adapters. Company
signals are now first-class in the Queue (approval creates a Company, ADR-0016), but the
company-to-people *expansion* job (normalize-expand, roadmap M2) is still deferred - the Company
detail shows "Expand to people" as a disabled, soon affordance.

## Conventions

1. **Slug = screen/flow identity**, not necessarily one capability. When a screen maps cleanly
   to one capability/component, share the slug (`review-queue`). For a cross-cutting flow, use a
   flow name (e.g. `daily-loop`) and anchor it to the [Primary journey](../../../docs/product-overview.md#primary-journey),
   which is a canonical named artifact - not to any single capability.
2. **Link in stable directions only** (this registry absorbs the many-to-many):
   - capability spec -> screen, via the `## Architecture` section of `openspec/specs/<capability>/spec.md` (many specs may point at one screen);
   - architecture docs -> this registry (one supplementary pointer, never per-component);
   - this registry -> everything else (here).
3. **Structure**: shared presentational primitives in `_components/`; each screen's mock data in
   `_data/<slug>.ts`. Per the rule of three, extract shared types/components only when a second
   or third screen needs them - until then a screen's types live with its data.
4. **Graduation**: a `locked` screen moves into a wired `(anchor)` route, swapping mock `_data`
   for `db`/`jobs` reads. The prototype screen is then kept as reference or removed.

## Verify-gate isolation

Exploration must not fight the production gate:

- **Coverage**: `src/app/**` is already excluded (`vitest.config.ts`), so no per-file floor here.
- **Duplication**: `**/prototype/**` is ignored in `.jscpd.json` (mockups repeat card/row markup
  by nature). Rationale recorded in [docs/process/engineering.md](../../../docs/process/engineering.md#duplication-jscpd).

It still typechecks, lints, and builds - it is real code, just unwired and ungated for coverage/dup.

## Production

`next build` currently ships `/prototype/*` as routes. There is no production deploy today (D1),
so this is moot now; when the product is deployed, gate the prototype behind `notFound()` in
production so mockups never reach users.

## Run

```
npm run dev
# then open the screen, e.g.
http://127.0.0.1:4321/prototype/queue
```

Bind to `127.0.0.1` on a free port (`next dev -p 4321 -H 127.0.0.1`) if `localhost:3000` is held
by another listener (VS Code's port-forwarder, for instance).
