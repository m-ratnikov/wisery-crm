## Context

The wired routes (`src/app/page.tsx`, `icp-config/`, `prospect-list/`, `prospect-list/[id]/`, `review-queue/`) each render a full-bleed `<div className="flex flex-1 flex-col ...">` directly under the root layout. The root `src/app/layout.tsx` is the stock create-next-app shell (html/body/fonts, `min-h-full flex flex-col`) with no navigation chrome. The only between-view navigation is the link grid on the home page, and there is no global home link or settings screen.

The intended design already exists as a mock at `src/app/prototype/(app)/layout.tsx`: a route-group layout rendering a persistent left sidebar (home link, the three anchor views in daily-loop order, a Settings link, a sign-out footer) beside a scrollable `<main>`. That prototype proves the layout and Tailwind styling; this change graduates it to the wired routes.

The settings data seam already exists: `src/lib/enrich/settings.ts` exposes `getSettings()` (idempotent single-row read) and `setAutoEnrich(boolean)`. No new data layer is needed.

## Goals / Non-Goals

**Goals:**
- One shared shell wraps every wired route; home and settings are reachable from any page.
- The current route is indicated in the sidebar.
- A wired `/settings` route reads and edits the auto-enrich flag through the existing seam.
- Reuse the prototype shell's structure and Tailwind classes; no new design language.

**Non-Goals:**
- No domain-model, schema, migration, pipeline, or job changes.
- No auth / sign-out behavior (the prototype's sign-out is a mock; deferred under D1). A sign-out affordance is out of scope - the footer, if kept, is non-functional and labeled.
- No change to the `/prototype` tree.
- No new settings fields beyond surfacing the existing auto-enrich flag. The prototype's account fields and connected-scrapers list are mock-only and are not wired here (connected scrapers arrive with the source-connection-wizard change).

## Decisions

### D1. Use a `(app)` route group for the shell, mirroring the prototype

Create `src/app/(app)/layout.tsx` holding the sidebar shell, and move the wired routes into the group: `(app)/page.tsx`, `(app)/icp-config/`, `(app)/prospect-list/`, `(app)/review-queue/`, and the new `(app)/settings/`. Route groups do not affect the URL, so `/`, `/icp-config`, `/prospect-list`, `/prospect-list/[id]`, and `/review-queue` stay identical. The root `layout.tsx` keeps only html/body/fonts.

- **Why over a nested non-group layout**: the home page lives at `/`, so its shell must come from a layout at the same segment. A route group lets the shell wrap `/` and its siblings while keeping `api/health` and `prototype/` (which has its own shell) outside the group. This is exactly the prototype's structure, so the graduation is a near-move.
- **Why not wrap in the root layout**: the root layout also wraps `api/` route handlers and the `prototype/` tree; putting the sidebar there would leak it into both. A group scopes the chrome to the wired app pages only.
- **Alternative considered**: keep files in place and add a non-group `layout.tsx` next to `page.tsx`. Rejected: a layout at `src/app/layout.tsx` is the root (already taken), and there is no intermediate segment to attach a wired-only layout to without a group.

### D2. Active-route state in a small client nav-link component

The sidebar layout stays a Server Component. Active highlighting needs the current path, so extract a small `'use client'` `NavLink` component that calls `usePathname()` and compares against its `href` (exact match for `/`, prefix match for sub-trees like `/prospect-list` so the detail page keeps its parent active). This is the only `'use client'` in the change; reason: `usePathname` is a client hook.

- **Why prefix match for sub-trees**: `/prospect-list/[id]` should keep "Prospect list" active. Exact-match-plus-startsWith with a guard against `/` matching everything.

### D3. Settings route reuses the existing seam; edit via a Server Action

`(app)/settings/page.tsx` is a Server Component that calls `getSettings()` and renders the auto-enrich value. A colocated `'use server'` action calls `setAutoEnrich(...)` and `revalidatePath('/settings')`. This mirrors the existing wired pattern (e.g. `icp-config/page.tsx` + `actions.ts` reusing `src/lib/icp/config.ts`); no new data module, no client state needed for the toggle (a form submit suffices). D1: the action is unauthenticated by design, consistent with the other wired actions; auth attaches at productization.

### D4. Home page slims to defer to the sidebar

`page.tsx` keeps its intro copy but the navigation link grid becomes redundant once the sidebar carries it. Keep a short orientation (the suggested flow line) and drop or de-emphasize the grid to avoid two parallel navigations. Minor; the requirement is only that home renders inside the shell.

## Risks / Trade-offs

- **Moving route folders could break relative imports** -> the pages import via the `@/` alias (e.g. `@/lib/...`) and colocated `./actions`, `./_components`; a folder move within `src/app` keeps both working. Verify `npm run verify` (typecheck + build) after the move.
- **`usePathname` prefix matching could mis-highlight** (e.g. a future `/prospect-list-archive` matching `/prospect-list`) -> match on segment boundary (`pathname === href || pathname.startsWith(href + '/')`), not bare `startsWith`.
- **Two shells drift** (wired vs prototype) -> accepted: the prototype is explicitly mock/throwaway provenance; the wired shell is canonical. They are allowed to diverge; jscpd already ignores `**/prototype/**`.
- **Duplication between the two shells** could trip jscpd -> the wired shell is authored fresh (not copied verbatim); the prototype is ignored by jscpd, so only intra-wired duplication matters, and the `NavLink` extraction keeps the markup DRY.

## Migration Plan

Pure code reorganization plus new files; no data migration. Steps: (1) add `(app)/layout.tsx` + `NavLink`; (2) move the wired route folders into `(app)/`; (3) add `(app)/settings/`; (4) slim `page.tsx`; (5) confirm URLs unchanged and `npm run verify` green. Rollback is a git revert - no persisted state changes.
