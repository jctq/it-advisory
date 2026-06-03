# TeqMD — Turborepo

Monorepo for **TeqMD**, a Philippines-first technology advisory platform: guided diagnostic → service recommendation → booking and payment, with a full admin CRM on top.

## Product overview

**Marketing funnel (web + native)**

- Configurable **diagnostic templates** (admin-built rounds, questions, and branching) with AI-assisted rounds and semantic cache reuse
- **Booking** with advisor schedule rules, slot caps, payment holds, and checkout via Philippine-friendly gateways
- Optional **marketing accounts** (email/password) for saved diagnostics, profile, and support report history
- **Blog**, legal pages (CMS-backed or built-in), cookie-consent-aware analytics, and SEO defaults per page
- In-app **support reports** with screenshots (web and native)

**Admin CRM**

- Dashboard, diagnostic sessions, leads, marketing users, bookings (table + calendar), refunds, support inbox
- **Settings** workspace: general, SEO, pricing, payments, email, support, meetings, recordings
- Visual **diagnostic template editor**, blog CMS (MDX), testimonials, advisor schedule, debug tools, and founder **advisor chat**
- First-visit **onboarding tour** (driver.js) — see [`docs/admin-onboarding.md`](docs/admin-onboarding.md)

## Monorepo layout

| Path | Role |
|------|------|
| `apps/web` | Next.js 16 marketing site + admin panel + API routes |
| `apps/native` | Expo / React Native client (iOS, Android, web) |
| `packages/domain` | Shared MongoDB collection names and persisted types |
| `packages/diagnostic-core` | Diagnostic flow logic shared by web and native |
| `packages/api-client` | Typed fetch clients for marketing and admin APIs |
| `packages/payments` | Payment gateway adapters (PayMongo, Xendit, HitPay, PayPal, mock) |

## Stack

- **Turborepo** + **pnpm** workspaces · Node **>= 22**
- **Next.js 16** (App Router, Turbopack dev) · **React 19**
- **Expo / React Native** in `apps/native`
- **Tailwind CSS v4**, **shadcn/ui**-style primitives
- **TanStack Query** + **TanStack Table** (10 rows per page on admin lists)
- **Zustand** for marketing flow state · **Auth.js v5** (NextAuth) for admin OAuth
- **MongoDB** (Atlas) via the official driver and a process-wide client singleton tuned for **Railway**
- **Vitest** for unit tests in `apps/web`, `packages/payments`, and related packages

## Commands

```bash
pnpm install
pnpm dev              # Next.js via Turbo (apps/web)
pnpm build
pnpm lint
pnpm check-types
pnpm test             # Vitest across workspaces
pnpm format           # Prettier
pnpm db:ensure-indexes   # Create TTL and lookup indexes in Atlas
```

The native app runs separately:

```bash
pnpm --filter native run ios
pnpm --filter native run android
pnpm --filter native run web
pnpm --filter native run check-types
```

## Environment

Copy `apps/web/.env.example` → `apps/web/.env.local` and set at least `MONGODB_URI`. Allow your Railway egress IPs (or `0.0.0.0/0` for a prototype) in Atlas Network Access.

Copy `apps/native/.env.example` → `apps/native/.env.local` and set `EXPO_PUBLIC_API_BASE_URL` to a reachable Railway or LAN URL for the web backend.

The example file documents all optional and production-required variables. Highlights:

| Area | Key variables |
|------|----------------|
| Core | `MONGODB_URI`, `MONGODB_DB_NAME`, `NEXT_PUBLIC_APP_URL`, `SITE_NAME` |
| Diagnostic AI | `OPENAI_API_KEY`, `OPENAI_DIAGNOSTIC_MODEL`, cache / vector search vars |
| Admin auth | `AUTH_SECRET`, `ADMIN_ALLOWED_EMAILS`, Google or Microsoft OAuth, `ADMIN_EMAIL_OTP_REQUIRED` |
| Secrets | `PAYMENT_CREDENTIALS_MASTER_KEY`, `EMAIL_CREDENTIALS_MASTER_KEY`, `MEETINGS_CREDENTIALS_MASTER_KEY` |
| Booking links | `BOOKING_SESSION_ACCESS_SECRET`, `DIAGNOSTIC_SESSION_URL_SECRET` |
| Cron | `CRON_SECRET` |
| Rate limits | `RATE_LIMIT_*_PER_HOUR` (see `.env.example`) |
| Meetings / Fathom | Zoom, Google Meet, Teams, and Fathom env fallbacks (prefer Admin → Settings) |

Production startup validates required secrets via `src/instrumentation.ts`.

## Data model (MongoDB)

Collection names and shared types live in `packages/domain/src`. Run `pnpm db:ensure-indexes` after first deploy for TTL buckets, refund lookups, and admin OTP indexes.

Suggested indexes (create in Atlas when you begin writing documents):

- `diagnostic_sessions`: `{ visitorId: 1, updatedAt: -1 }`
- `diagnostic_audit`: `{ visitorId: 1, createdAt: -1 }`, `{ sessionId: 1, createdAt: 1 }`
- `diagnostic_templates`: `{ slug: 1 }` unique, `{ updatedAt: -1 }`
- `diagnostic_round_cache`: `{ threadHash: 1 }` unique. For **semantic** reuse, add an Atlas **Vector Search** index on path `embedding` (1536 dimensions, cosine) and set `DIAGNOSTIC_CACHE_VECTOR_INDEX_NAME`.
- `diagnostic_template_summary_cache`: `{ threadHash: 1 }` unique
- `visitor_sessions`: `{ visitorId: 1 }` unique
- `users`: `{ email: 1 }` unique
- `user_auth_sessions`: TTL on `expiresAt`
- `leads`: `{ createdAt: -1 }`, `{ phone: 1 }` (optional search)
- `bookings`: `{ startsAt: 1 }`, `{ leadId: 1 }`, `{ visitorId: 1, serviceKey: 1, startsAt: 1 }`. For solo-advisor slot exclusivity, add a **partial unique** index: `{ serviceKey: 1, startsAt: 1 }` unique with `partialFilterExpression: { status: { $in: ['pending', 'confirmed'] } }`.
- `booking_refunds`: `{ status: 1, requestedAt: -1 }`, `{ bookingId: 1 }`
- `advisor_booking_settings`: singleton `{ _id: 'default' }`
- `payment_transactions`: `{ visitorId: 1, status: 1, updatedAt: -1 }`
- `payment_logs`, `cron_job_runs`: `{ createdAt: -1 }`
- `email_settings`, `payment_settings`, `meeting_settings`, `recording_settings`, `monetization_settings`, `support_settings`, `seo_settings`, `app_settings`: singleton `{ _id: 'default' }` (or `'app'` for `app_settings`)
- `email_sends`: `{ createdAt: -1 }`, `{ to: 1 }`
- `blog_posts`: `{ slug: 1 }` unique, `{ status: 1, publishedAt: -1 }`
- `blog_post_revisions`: `{ postId: 1, createdAt: -1 }`
- `support_reports`: `{ status: 1, createdAt: -1 }`, `{ visitorId: 1, createdAt: -1 }`
- `testimonials`: `{ sortOrder: 1 }`, `{ published: 1 }`
- `rate_limit_buckets`: unique `{ scope, identifier, windowStartMs }`, TTL on `expiresAt`
- `admin_auth_sessions`, `admin_otp_challenges`, `admin_otp_verifications`, `security_events`: TTL on `expiresAt`; OTP collections also unique on `email`
- `fathom_webhook_deliveries`: idempotency key for recording webhooks

Legacy `availability_slots` is unused by the current rule-based schedule.

## Railway

1. Create a service from this repo; set **root directory** to the repository root (or monorepo-aware build).
2. **Build command:** `pnpm install && pnpm build`
3. **Start command:** `pnpm --filter web start`
4. Set `MONGODB_URI`, `MONGODB_DB_NAME`, and `NEXT_PUBLIC_APP_URL` to your Railway URL.
5. Leave `NEXT_PUBLIC_API_BASE_URL` unset for normal same-origin Railway deploys, or set it only for split-origin scenarios.
6. After first deploy, run `pnpm db:ensure-indexes` locally (or in a one-off job) against the same Atlas cluster.

### Payment-hold cron (`/api/cron/payment-holds`)

The route expires stale checkout holds, reconciles stuck payments, and cancels unpaid bookings past their hold window.

**Railway Cron (recommended):** use a dedicated short-lived service (not your web server) with the same env vars as `web` (`MONGODB_URI`, etc.) and a cron schedule. **Start command:**

```bash
pnpm --filter web cron:payment-holds
```

The process must exit when finished. Do not point cron at `http://api/...` — that hostname only exists in some local Docker Compose setups.

**HTTP trigger (optional):**

```bash
curl -sS -X POST "https://YOUR_APP.up.railway.app/api/cron/payment-holds" \
  -H "Authorization: Bearer $CRON_SECRET"
```

Set `CRON_SECRET` in production (required for HTTP cron). When unset in development, the route accepts any caller.

## Native app

`apps/native` is the React Native / Expo client for iOS, Android, and Expo web.

The native app talks to the Next.js backend and persists anonymous diagnostic progress with the `X-Device-Id` header instead of browser cookies. Booking checkout, support reports, and account flows mirror the marketing site.

## Payments

Configure live gateways in **Admin → Settings → Payments** (credentials encrypted with `PAYMENT_CREDENTIALS_MASTER_KEY`):

- **PayMongo** — cards, GCash, Maya, GrabPay, ShopeePay
- **Xendit** — cards and Philippine e-wallets
- **HitPay** — cards, GCash, PayNow
- **PayPal**

When no gateway is active, checkout uses the **mock adapter** (`@teqmd/payments`) for local development. Payment holds, webhooks, reconciliation, and refund requests are handled in `apps/web/src/lib/payments/`.

## Email

**Admin → Settings → Email** (MongoDB `email_settings`): one active provider (Resend, Postmark, or SendGrid), optional BCC, and **Sandbox mode** (redirects `To` to [Resend test inboxes](https://resend.com/docs/dashboard/emails/send-test-emails), skips BCC, stores real recipient on `email_sends`). Provider secrets use `EMAIL_CREDENTIALS_MASTER_KEY` (AES-256-GCM). With **Active provider = None**, `RESEND_API_KEY` + `EMAIL_FROM` env fallback still applies.

Transactional templates cover booking confirmation, payment reminders, admin OTP codes, and more. Preview them from the admin debug workspace.

## Meetings and recordings

**Admin → Settings → Meetings** stores encrypted credentials for **Zoom**, **Google Meet**, or **Microsoft Teams**. Booking confirmation emails include join links when a provider is configured. Env-var fallbacks are documented in `.env.example`.

**Admin → Settings → Recordings** configures **Fathom** for consultation recording opt-in and webhook delivery. See [`docs/fathom-setup.md`](docs/fathom-setup.md) and [`docs/google-meet-oauth-setup.md`](docs/google-meet-oauth-setup.md).

## Auth

**Marketing accounts** use email/password with server-side sessions (`user_auth_sessions` cookie). Registration requires acceptance of terms/privacy (CMS embed or built-in copy).

**Admin access** is gated in `src/proxy.ts` (Next.js network boundary):

1. Sign in at `/admin/login` with **Google** or **Microsoft Entra ID** OAuth (Auth.js v5).
2. Only emails in `ADMIN_ALLOWED_EMAILS` may proceed.
3. When `ADMIN_EMAIL_OTP_REQUIRED=1`, a one-time code is emailed after OAuth; complete verification at `/admin/verify-otp`.

Scripts and automation may use `Authorization: Bearer <ADMIN_SERVICE_TOKEN>` (legacy `ADMIN_TOKEN` alias). Log out via `POST /api/admin/logout`. In development, `ALLOW_DEV_ADMIN_OPEN=1` bypasses OAuth when providers are unset.

## Security

- **Rate limiting** (MongoDB `rate_limit_buckets`): auth, admin login/OTP, diagnostic AI, booking creation, support reports, and guest booking lookup. Tune via `RATE_LIMIT_*` env vars.
- **Content-Security-Policy**: report-only by default; set `CSP_ENFORCE=1` to enforce.
- **Security audit log** (`security_events`) for admin auth events with TTL retention.
- Production validates OAuth, master keys, cron secret, and opaque URL secrets at startup.

## Admin advisor

Founder-facing strategic chat at `/admin/advisor`, separate from the customer diagnostic intake. Uses `streamText` (free-form prose, not JSON schema), no caching, and a stronger model.

- **Model:** `OPENAI_ADVISOR_MODEL` (default `gpt-4.1`). Customer intake stays on `OPENAI_DIAGNOSTIC_MODEL` (default `gpt-4o-mini`).
- **System prompt:** rendered from typed `AdvisorContext` in `apps/web/src/lib/ai/advisor-prompt.ts`.
- Requires the same admin OAuth (and OTP when enabled) as the rest of `/admin`.

## Documentation

| Doc | Topic |
|-----|-------|
| [`docs/admin-onboarding.md`](docs/admin-onboarding.md) | Admin guided tour (driver.js) |
| [`docs/teqmd-registration-checklist.md`](docs/teqmd-registration-checklist.md) | Launch / registration checklist |
| [`docs/data-subject-erasure-checklist.md`](docs/data-subject-erasure-checklist.md) | GDPR-style erasure workflow |
| [`docs/fathom-setup.md`](docs/fathom-setup.md) | Fathom recording integration |
| [`docs/google-meet-oauth-setup.md`](docs/google-meet-oauth-setup.md) | Google Meet OAuth for bookings |
