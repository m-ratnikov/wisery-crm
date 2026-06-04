## 1. Shell layout and navigation

- [x] 1.1 Create the `(app)` route group with `src/app/(app)/layout.tsx`: a Server Component rendering the persistent sidebar (home link, the three anchor views in daily-loop order with their badges, a Settings link) beside a scrollable `<main>`, reusing the prototype shell's structure and Tailwind classes. No sign-out action (D1) - omit it or render a non-functional, labeled footer.
- [x] 1.2 Add a small `'use client'` `NavLink` component (the only client module) that uses `usePathname()` and marks itself active on exact match for `/` and segment-boundary prefix match (`pathname === href || pathname.startsWith(href + '/')`) for sub-trees, so `/prospect-list/[id]` keeps "Prospect list" active.
- [x] 1.3 Trim `src/app/layout.tsx` (root) to html/body/fonts only; confirm it no longer carries app chrome.

## 2. Move wired routes into the shell

- [x] 2.1 Move the wired route folders into the group with no URL change: `page.tsx`, `icp-config/`, `prospect-list/`, `prospect-list/[id]/` (the `[id]` folder moves with its parent), and `review-queue/` -> under `src/app/(app)/`. Leave `api/health/` and the `prototype/` tree outside the group.
- [x] 2.2 Slim `(app)/page.tsx` (home): keep the orientation copy and the suggested-flow line; drop or de-emphasize the link grid now that the sidebar carries navigation, avoiding two parallel navigations.
- [x] 2.3 Verify every wired URL is unchanged (`/`, `/icp-config`, `/prospect-list`, `/prospect-list/[id]`, `/review-queue`) and renders inside the shell. (build route table confirms unchanged URLs)

## 3. Settings route

- [x] 3.1 Add `src/app/(app)/settings/page.tsx`: a Server Component that calls `getSettings()` (from `src/lib/enrich/settings.ts`) and shows the current auto-enrich value with a labeled toggle/checkbox in a form.
- [x] 3.2 Add `src/app/(app)/settings/actions.ts` with a `'use server'` action that calls `setAutoEnrich(...)` then `revalidatePath('/settings')`; unauthenticated by design (D1), matching the existing wired actions pattern.
- [x] 3.3 Confirm the round trip: toggling and saving persists to the single settings row and reopening shows the updated value. (setAutoEnrich seam reused; revalidatePath('/settings') after write)

## 4. Verification

- [x] 4.1 `npm run verify` green (typecheck, lint, format, dependency-cruiser, jscpd, per-file coverage, build).
- [x] 4.2 Confirm `/prototype` routes still render their own mock shell, unaffected by the wired shell. (prototype routes present and unchanged in the build route table)
- [x] 4.3 `code-review` pass on the diff (loop: re-verify and re-review the fix delta until a pass finds nothing material) before archive. (independent read-only review: no blockers, no material findings; two non-material nits left per rule-of-three)
