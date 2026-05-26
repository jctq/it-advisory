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
| Popover theming | `apps/web/src/app/globals.css` (`.admin-driver-popover`) |

**First visit:** A welcome dialog opens once per browser (`techmd-admin-onboarding-welcome-seen`). The user can start the full tour or dismiss it.

**Replay:** The **Guide** button in the admin header restarts the tour anytime.

**Full tour behavior:** After the sidebar intro, the tour highlights each nav item, **navigates to that route**, and highlights in-page UI. It ends with header appearance controls and the Guide button (~28 steps total).

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
| `/admin/schedule` | `page-schedule-calendar` | `admin-advisor-schedule-manager.tsx` (loaded schedule tabs) |
| `/admin/bookings` | `page-bookings-filters`, `page-bookings-calendar` | `admin-bookings-workspace.tsx` |
| `/admin/advisor` | `page-advisor-chat` | `advisor-chat.tsx` |
| `/admin/settings` | `page-settings-tabs`, `page-settings-content` | `admin-settings-workspace.tsx` |

## Not yet in the tour

Detail/editor routes (add when needed):

| Route | Suggested targets |
|-------|-------------------|
| `/admin/diagnostic-templates/[templateId]` | Canvas, palette, inspector |
| `/admin/blog-posts/[postId]` | MDX editor, publish |
| `/admin/sessions/[sessionId]` | Audit trail, booking link |
| `/admin/bookings/[bookingId]` | Payment, Meet, quote |
| `/admin/users/[userId]` | Sessions list |

## Adding a new page or step

1. Add target id to `AdminOnboardingPageTarget` or `AdminOnboardingShellTarget` in `admin-onboarding.ts`.
2. Mark DOM: `data-admin-tour="your-target"` (or `tourTarget` on `AdminPageHeader`).
3. Add step to `admin-onboarding-page-steps.ts` (include `routePath` for page steps).
4. Wire segment in `ADMIN_ONBOARDING_PAGE_SEGMENTS` inside `admin-onboarding.ts` if it is a new nav area.
5. If the step is in the main content on mobile, add the target to `ADMIN_ONBOARDING_MOBILE_SIDEBAR_CLOSED_TARGETS`.
6. Update this document.

## Mobile sidebar

- **Nav / sidebar steps:** drawer opens automatically.
- **Page + header steps:** drawer closes so highlights are visible.
- **Back** to a nav step reopens the drawer.

## Testing locally

```js
localStorage.removeItem('techmd-admin-onboarding-welcome-seen')
```

Reload `/admin`, start the tour, and confirm each route loads before its page highlights.

## Dependencies

- [driver.js](https://driverjs.com/) v1.x — `apps/web` package; CSS in `admin-onboarding-provider.tsx`.
