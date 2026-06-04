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
| Review & approve queue | `/prototype/review-queue` | graduated | "Review and approve queue", anchor #2 - **wired live at `/review-queue`** (Server Component cards over the queue read-model; act / dismiss / log-outcome Server Actions; closes the D7 loop); this prototype screen stays the design reference | review-queue, enrichment (dossier), drafting (draft), qualification (score), tracking (outcome) | [anchor-view wireframes](../../../docs/explore/2026-05-26-anchor-view-wireframes.md) |
| Prospect list | `/prototype/prospect-list` | graduated | "Prospect list", anchor #3 - **wired live at `/prospect-list`** (Server Component grid + detail + Server Actions over the read-model; manual/batch enrich + auto-enrich toggle); this prototype screen stays the design reference. Status vocabulary reconciled to ADR-0008 (7-value disposition; enriched/drafted shown as derived facet chips, not statuses). | prospect-list, qualification (score), signal-ingestion (source/signal), enrichment (dossier), tracking (outcome) | [anchor-view wireframes](../../../docs/explore/2026-05-26-anchor-view-wireframes.md) |
| ICP & source config | `/prototype/icp-config` | graduated | "ICP and source config", anchor #1 - **wired live at `/icp-config`** (Server Component + Server Actions over `src/lib/icp`); this prototype screen stays the design reference | icp-config (rubric + profile, config-as-data), source-adapters (source config), signal-ingestion (scan status) | [anchor-view wireframes](../../../docs/explore/2026-05-26-anchor-view-wireframes.md) |
| Whole-app shell | `/prototype` | sketch | integration flow -> [Primary journey](../../../docs/product-overview.md#primary-journey) | all anchor views (funnel + deep links) + live pipeline activity | [anchor-view wireframes](../../../docs/explore/2026-05-26-anchor-view-wireframes.md) |
| Settings | `/prototype/settings` | sketch | plumbing (not an anchor) | account; source-adapters (connected scrapers, read-only in MVP, V2-expandable) | - |
| Background jobs monitor | `/jobs` | wired (built directly, no prototype) | Operations view (not an anchor) - read-only observability of the in-process pg-boss pipeline | job-activity-monitor, scan-run-history (recent scan outcomes), background-jobs (activity introspection), app-shell (operations nav) | - |
| Sign in | `/prototype/sign-in` | sketch | plumbing (not an anchor) | auth (email/password; Google SSO is V2) | - |
| Sign up | `/prototype/sign-up` | sketch | plumbing (not an anchor) | auth (email/password; Google SSO is V2) | - |

**Status lifecycle**: `sketch` -> `in-review` -> `locked` -> `graduated` (wired into `(anchor)`).

**Anchor views vs plumbing.** The thesis still commits to exactly three hand-built *anchor*
views (ICP config, prospect list, review queue). Settings and auth are standard plumbing UI -
real, hand-built screens, but not anchor views and not generative. They are listed here because
they are part of the clickable app.

**Operations views skip the prototype.** A read-only observability surface (the jobs monitor)
has low layout ambiguity and no high-judgment action, so it is built directly as a wired screen
without a prototype mockup. It is still registered here so the capability spec -> screen link
resolves; it is neither an anchor view nor generative.

**Routing.** The signed-in app screens live under the `(app)/` route group (its `layout.tsx`
owns the sidebar chrome; `_data/` and `_components/` live there too). The auth screens
(`sign-in`, `sign-up`) sit at the `prototype/` root so they render full-bleed with no sidebar;
their shared chrome is in `_auth/`. Route groups do not change URLs, so `/prototype`,
`/prototype/icp-config`, etc. are unchanged.

**People-first MVP.** Sources and connected scrapers are the two person scrapers (LinkedIn, X).
Company-list (CSV) and news scrapers expand to people (normalize-expand, roadmap M2) and are
shown as V2 - disabled in the source picker and marked V2 in Settings.

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
  by nature). Rationale recorded in [docs/engineering.md](../../../docs/engineering.md#duplication-jscpd).

It still typechecks, lints, and builds - it is real code, just unwired and ungated for coverage/dup.

## Production

`next build` currently ships `/prototype/*` as routes. There is no production deploy today (D1),
so this is moot now; when the product is deployed, gate the prototype behind `notFound()` in
production so mockups never reach users.

## Run

```
npm run dev
# then open the screen, e.g.
http://127.0.0.1:4321/prototype/review-queue
```

Bind to `127.0.0.1` on a free port (`next dev -p 4321 -H 127.0.0.1`) if `localhost:3000` is held
by another listener (VS Code's port-forwarder, for instance).
