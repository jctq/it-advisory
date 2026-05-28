# TechMD — Turborepo

Monorepo for **TechMD**, a Philippines-first technology advisory funnel: quiz → recommendation → booking, with admin CRM tables.

## Stack

- **Turborepo** + **pnpm** workspaces
- **Next.js 16** (App Router) in `apps/web`
- **Expo / React Native** native app in `apps/native`
- **Tailwind CSS v4**, **shadcn/ui**-style primitives (`components.json`, `Button`)
- **TanStack Query** + **TanStack Table** (10 rows per page on admin lists)
- **MongoDB** (Atlas) via the official driver and a process-wide client singleton tuned for **Railway**

## Commands

```bash
pnpm install
pnpm dev
pnpm build
pnpm lint
```

Dev runs the Next app via Turbo (`apps/web`). The native app runs separately with Expo from `apps/native`.

## Environment

Copy `apps/web/.env.example` to `apps/web/.env.local` and set `MONGODB_URI` from Atlas. Allow your Railway egress IPs (or `0.0.0.0/0` for a prototype) in Atlas Network Access.

Copy `apps/native/.env.example` to `apps/native/.env.local` and set `EXPO_PUBLIC_API_BASE_URL` to a reachable Railway or LAN URL for the web backend.

## Data model (MongoDB)

Collection names and shared persisted types live in `packages/domain/src`.

Suggested indexes (create in Atlas when you begin writing documents):

- `quiz_sessions`: `{ visitorId: 1, updatedAt: -1 }`
- `quiz_audit`: `{ visitorId: 1, createdAt: -1 }`, `{ sessionId: 1, createdAt: 1 }`
- `visitor_sessions`: `{ visitorId: 1 }` unique
- `leads`: `{ createdAt: -1 }`, `{ phone: 1 }` (optional, search)
- `bookings`: `{ startsAt: 1 }`, `{ leadId: 1 }`, `{ visitorId: 1, serviceKey: 1, startsAt: 1 }` (idempotent re-confirmation / slot lookup). For solo-advisor slot exclusivity, add a **partial unique** index: `{ serviceKey: 1, startsAt: 1 }` unique with `partialFilterExpression: { status: { $in: ['pending', 'confirmed'] } }` so cancelled rows do not block reuse.
- `advisor_booking_settings`: singleton `{ _id: 'default' }` (no extra index required beyond `_id`).
- `availability_slots`: `{ startsAt: 1, timezone: 1 }` (legacy / unused by current rule-based schedule)
- `email_settings`: singleton `{ _id: 'default' }` (admin transactional email providers).
- `monetization_settings`: singleton `{ _id: 'default' }` (service catalog, packages, promo codes).
- `email_sends`: `{ createdAt: -1 }`, `{ to: 1 }`
- `diagnostic_round_cache`: `{ threadHash: 1 }` unique. For **semantic** reuse of similar prompts, add an Atlas **Vector Search** index on path `embedding` (1536 dimensions, cosine, matching `OPENAI_EMBEDDING_MODEL` / `OPENAI_EMBEDDING_DIMENSIONS`) and **filter** fields `cacheVersion`, `roundsCompleted`; set `DIAGNOSTIC_CACHE_VECTOR_INDEX_NAME` to that index name in `apps/web/.env.local`.
- `blog_posts`: `{ slug: 1 }` unique, `{ status: 1, publishedAt: -1 }` (marketing blog index).

## Railway

1. Create a service from this repo; set **root directory** to the repository root (or monorepo-aware build).
2. **Build command:** `pnpm install && pnpm build`
3. **Start command:** `pnpm --filter web start`
4. Set `MONGODB_URI`, `MONGODB_DB_NAME`, and `NEXT_PUBLIC_APP_URL` to your Railway URL.
5. Leave `NEXT_PUBLIC_API_BASE_URL` unset for normal same-origin Railway deploys, or set it only for split-origin scenarios.

Node **>= 22** matches `package.json` engines.

### Payment-hold cron (`/api/cron/payment-holds`)

The route expires stale checkout holds, reconciles stuck payments, and cancels unpaid bookings past their hold window.

**Railway Cron (recommended):** use a dedicated short-lived service (not your web server) with the same env vars as `web` (`MONGODB_URI`, etc.) and a cron schedule. **Start command:**

```bash
pnpm --filter web cron:payment-holds
```

The process must exit when finished (the script above does). Do not point cron at `http://api/...` — that hostname only exists in some local Docker Compose setups and causes `getaddrinfo ENOTFOUND api` in production.

**HTTP trigger (optional):** if you call the route from another scheduler instead, use your public app URL, for example:

```bash
curl -sS -X POST "https://YOUR_APP.up.railway.app/api/cron/payment-holds" \
  -H "Authorization: Bearer $CRON_SECRET"
```

Set `CRON_SECRET` in production when using the HTTP route; when unset, the route accepts any caller (dev only).

## Native app

`apps/native` is the real React Native / Expo client for iOS and Android.

- `pnpm --filter native run check-types`
- `pnpm --filter native run ios`
- `pnpm --filter native run android`
- `pnpm --filter native run web`

The native app talks to the existing Next.js backend and persists anonymous quiz progress with the `X-Device-Id` header instead of browser cookies.

## Mock integrations

- **Email:** Admin **Settings → Email** tab (MongoDB `email_settings`): one active provider (Resend, Postmark, or SendGrid), optional BCC, and **Sandbox mode** (redirects `To` to [Resend test inboxes](https://resend.com/docs/dashboard/emails/send-test-emails) such as `delivered@resend.dev`, skips BCC, stores real recipient on `email_sends`). Provider secrets use `EMAIL_CREDENTIALS_MASTER_KEY` (AES-256-GCM); older installs may still decrypt blobs written with `PAYMENT_CREDENTIALS_MASTER_KEY` until credentials are re-saved. With **Active provider = None**, `RESEND_API_KEY` + `EMAIL_FROM` env fallback still applies.
- **Payments:** `src/lib/payments/mock-payments.ts` returns fake references.

Replace payment mocks with live gateways when ready.

## Auth

Admin and customer accounts are planned but not wired yet. The current `src/proxy.ts` (Next.js 16 network boundary) enforces a single shared `ADMIN_TOKEN` for `/admin/...` and `/api/admin/...` routes. Swap for a real session/identity provider (NextAuth/Clerk) when ready.

## Admin advisor

Founder-facing strategic chat at `/admin/advisor`, separate from the customer diagnostic intake. Uses `streamText` (free-form prose, not JSON schema), no caching, and a stronger model.

- **Model:** `OPENAI_ADVISOR_MODEL` (default `gpt-4.1`). Customer intake stays on `OPENAI_DIAGNOSTIC_MODEL` (default `gpt-4o-mini`) to keep the funnel cheap.
- **System prompt:** rendered from typed `AdvisorContext` in `apps/web/src/lib/ai/advisor-prompt.ts` — no `[INSERT NAME]` literals at runtime.
- **Auth:** set `ADMIN_TOKEN` to a long random string. Visit `/admin/login`, paste the token; the server sets an HttpOnly cookie. Unset in production yields 503; in development the gate is permissive so you can iterate locally.
