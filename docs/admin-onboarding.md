# Admin onboarding tour

This document is the **source of truth** for the TechMD admin guided tour ([driver.js](https://driverjs.com/)). Attach this file when adding admin features so agents know what is already covered and how to extend the tour.

## Overview

| Item | Location |
|------|----------|
| Tour step definitions (shell + merged order) | `apps/web/src/lib/admin/admin-onboarding.ts` |
| Per-page step copy | `apps/web/src/lib/admin/admin-onboarding-page-steps.ts` |
| Route navigation helpers | `apps/web/src/lib/admin/admin-onboarding-navigation.ts` |
| Driver.js provider & tour runner | `apps/web/src/components/admin/admin-onboarding-provider.tsx` |
| First-visit welcome dialog | `apps/web/src/components/admin/admin-onboarding-welcome-dialog.tsx` |
| Replay button (header) | `apps/web/src/components/admin/admin-onboarding-guide-button.tsx` |
| Shell integration | `apps/web/src/components/admin/admin-shell.tsx` |
| Sidebar `data-admin-tour` targets | `apps/web/src/components/admin/admin-sidebar.tsx` |
| Popover theming | `apps/web/src/app/globals.css` (`.admin-driver-popover`), `admin-driver-popover.css` (close button, loaded after driver.js) |

**First visit:** A welcome dialog opens once per browser (`techmd-admin-onboarding-welcome-seen`). The user can start the full tour or dismiss it.

**Replay:** The **Guide** button in the admin header restarts the tour anytime.

**Full tour behavior:** After the sidebar intro, the tour highlights each nav item, **navigates to that route**, and highlights in-page UI. Highlighted elements are **read-only** (`disableActiveInteraction` + CSS). It ends with header appearance controls and the Guide button (48 steps total).

## Tour flow

1. Sidebar intro (2 steps)
2. For each workspace: **nav link** → **page step(s)** (auto `router.push` when needed)
3. Header footer (3 steps): page title bar, appearance, Guide replay

## Shell steps

| `data-admin-tour` | Title |
|-------------------|-------|
| `sidebar` | Admin navigation |
| `sidebar-workspace` | Workspace overview |
| `nav-dashboard` … `nav-settings` | Sidebar link per area |
| `nav-support-reports` | Support reports |
| `nav-debug` | Debug |
| `admin-header` | Page context |
| `appearance-controls` | Appearance |
| `guide-button` | Replay this guide |

## Page steps (by route)

| Route | `data-admin-tour` target(s) | Component / file |
|-------|----------------------------|------------------|
| `/admin` | `page-dashboard-stats`, `page-dashboard-activity` | `admin-dashboard.tsx` |
| `/admin/diagnostic-templates` | `page-templates-list` | `diagnostic-templates-list.tsx` |
| `/admin/blog-posts` | `page-blog-list` | `blog-posts-list.tsx` |
| `/admin/sessions` | `page-sessions-table` | `quiz-sessions-table.tsx` |
| `/admin/leads` | `page-leads-table` | `leads-table.tsx` |
| `/admin/users` | `page-users-table` | `marketing-users-table.tsx` |
| `/admin/schedule` | `page-schedule-tabs`, `page-schedule-hours-grid`, `page-schedule-weekdays`, `page-schedule-dates`, `page-schedule-caps`, `page-schedule-preview` | `admin-advisor-schedule-manager.tsx` (tab via `?tab=` in `routeHref`) |
| `/admin/bookings` | `page-bookings-view-toggle`, `page-bookings-filters`, `page-bookings-table`, `page-bookings-calendar` | `admin-bookings-workspace.tsx` (view via `?view=calendar`) |
| `/admin/support-reports` | `page-support-reports-table` | `support-reports-table.tsx` |
| `/admin/debug` | `page-debug-tabs`, `page-debug-client-diagnostic`, `page-debug-cron-logs`, `page-debug-payment-logs` | `admin-debug-workspace.tsx` (tab via `?tab=` in `routeHref`) |
| `/admin/advisor` | `page-advisor-chat` | `advisor-chat.tsx` |
| `/admin/settings` | `page-settings-tabs`, `page-settings-general`, `page-settings-pricing`, `page-settings-payments`, `page-settings-email`, `page-settings-support`, `page-settings-meetings`, `page-settings-recordings` | `admin-settings-workspace.tsx` (tab via `?tab=` in `routeHref`) |

## Not yet in the tour

Detail/editor routes (add when needed):

| Route | Suggested targets |
|-------|-------------------|
| `/admin/diagnostic-templates/[templateId]` | Canvas, palette, inspector |
| `/admin/blog-posts/[postId]` | MDX editor, publish |
| `/admin/sessions/[sessionId]` | Audit trail, booking link |
| `/admin/bookings/[bookingId]` | Payment, Meet, quote |
| `/admin/users/[userId]` | Sessions list |
| `/admin/support-reports/[reportId]` | Reply thread, screenshots |

## Read-only highlights

- Global: `disableActiveInteraction: true` in `admin-onboarding-provider.tsx` and per step in `buildAdminOnboardingDriveSteps`.
- CSS fallback: `.driver-active .driver-active-element` uses `pointer-events: none` in `globals.css`.
- Users advance with **Next** / **Back** / **Done** on the popover only.

## Dismiss behavior

- **Welcome dialog:** closes only via the X control or footer buttons (`Maybe later` / `Start guided tour`). Outside click and Escape are ignored.
- **Tour:** dismiss only via the popover **X** (`allowClose`). Overlay clicks are ignored (`overlayClickBehavior` no-op). **Arrow Left / Right** move Back / Next; Escape does not close the tour.

## Adding a new page or step

1. Add target id to `AdminOnboardingPageTarget` or `AdminOnboardingShellTarget` in `admin-onboarding.ts`.
2. Mark DOM: `data-admin-tour="your-target"` (or `tourTarget` on `AdminPageHeader`).
3. Add step to `admin-onboarding-page-steps.ts` (include `routePath` for page steps).
4. Wire segment in `ADMIN_ONBOARDING_PAGE_SEGMENTS` inside `admin-onboarding.ts` if it is a new nav area.
5. If the step is in the main content on mobile, add the target to `ADMIN_ONBOARDING_MOBILE_SIDEBAR_CLOSED_TARGETS`.
6. Update this document and `admin-onboarding.test.ts` if expectations change.

## Mobile sidebar

- **Nav / sidebar steps:** drawer opens automatically.
- **Page + header steps:** drawer closes so highlights are visible.
- **Back** to a nav step reopens the drawer.

## Testing locally

```js
localStorage.removeItem('techmd-admin-onboarding-welcome-seen')
```

Reload `/admin`, start the tour, and confirm each route loads before its page highlights. Run unit tests:

```bash
pnpm --filter web exec vitest run src/lib/admin/admin-onboarding.test.ts
```

## Dependencies

- [driver.js](https://driverjs.com/) v1.x — `apps/web` package; CSS in `admin-onboarding-provider.tsx`.
