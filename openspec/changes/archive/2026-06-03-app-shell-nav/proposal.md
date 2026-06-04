## Why

The wired app has no navigation chrome. `src/app/layout.tsx` is still the stock create-next-app layout, so the only way to move between the three anchor views (ICP & source config, prospect list, review queue) is the link grid on the home page - and from any sub-page (for example `prospect-list/[id]`) there is no way back to home, no way to reach a settings screen, and no indication of where you are. The intended shell already exists as a mock at `src/app/prototype/(app)/layout.tsx`; this change graduates it into the wired app so the daily loop is navigable.

## What Changes

- Introduce a shared signed-in app shell (persistent left sidebar + main pane) that wraps the wired routes: home, `icp-config`, `prospect-list`, `prospect-list/[id]`, and `review-queue`.
- Sidebar surfaces a home / "daily loop" link, the three anchor views (in daily-loop order: configure, list, queue), and a Settings link; active-route highlighting shows the current location.
- Add a real `/settings` route - the wired counterpart to the prototype settings page - that reads and edits the single `settings` row, starting with the auto-enrich flag (ADR-0007).
- Reuse the prototype shell's structure and Tailwind styling; do not invent new chrome.
- Leave the `/prototype` routes untouched (they keep their own mock shell and mock data).
- No domain-model, schema, pipeline, or job changes. The `settings` table and its read/write seam already exist (used by enrichment); this only adds a UI surface over them.

## Capabilities

### New Capabilities
- `app-shell`: the wired application shell - persistent sidebar navigation across the anchor views, a home link reachable from every page, active-route indication, and a Settings screen that edits the per-tenant `settings` row (auto-enrich first).

### Modified Capabilities
<!-- None. The settings row and its read/write seam already exist (enrichment, ADR-0007); this change surfaces them in the UI without changing any spec-level requirement. -->

## Impact

- **New code**: a shared layout for the wired routes (an `(app)` route group or a refactor of `src/app/layout.tsx`), a small client nav-link component (`usePathname` for active state - the only `'use client'` needed), and a `src/app/settings/` route (page + server action) reusing the existing settings read/write seam.
- **Modified code**: `src/app/page.tsx` (home) renders inside the shell; the link grid may slim down now that the sidebar carries navigation. `src/app/layout.tsx` (root) stays minimal (html/body/fonts).
- **Unaffected**: all `src/lib` domain code, the `/prototype` route tree, the database schema and migrations, and all background jobs.
- **Dependencies**: none added. Next.js 16 App Router, React 19 Server Components, Tailwind 4 - all already in use.
