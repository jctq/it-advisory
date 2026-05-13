# IT Advisory — Turborepo

Monorepo for a Philippines-first IT advisory funnel: quiz → recommendation → booking, with admin CRM tables.

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
- `bookings`: `{ startsAt: 1 }`, `{ leadId: 1 }`, `{ visitorId: 1, serviceKey: 1, startsAt: 1 }` (idempotent re-confirmation / slot lookup)
- `availability_slots`: `{ startsAt: 1, timezone: 1 }`
- `email_sends`: `{ createdAt: -1 }`, `{ to: 1 }`
- `diagnostic_round_cache`: `{ threadHash: 1 }` unique. For **semantic** reuse of similar prompts, add an Atlas **Vector Search** index on path `embedding` (1536 dimensions, cosine, matching `OPENAI_EMBEDDING_MODEL` / `OPENAI_EMBEDDING_DIMENSIONS`) and **filter** fields `cacheVersion`, `roundsCompleted`; set `DIAGNOSTIC_CACHE_VECTOR_INDEX_NAME` to that index name in `apps/web/.env.local`.

## Railway

1. Create a service from this repo; set **root directory** to the repository root (or monorepo-aware build).
2. **Build command:** `pnpm install && pnpm build`
3. **Start command:** `pnpm --filter web start`
4. Set `MONGODB_URI`, `MONGODB_DB_NAME`, and `NEXT_PUBLIC_APP_URL` to your Railway URL.
5. Leave `NEXT_PUBLIC_API_BASE_URL` unset for normal same-origin Railway deploys, or set it only for split-origin scenarios.

Node **>= 22** matches `package.json` engines.

## Native app

`apps/native` is the real React Native / Expo client for iOS and Android.

- `pnpm --filter native run check-types`
- `pnpm --filter native run ios`
- `pnpm --filter native run android`
- `pnpm --filter native run web`

The native app talks to the existing Next.js backend and persists anonymous quiz progress with the `X-Device-Id` header instead of browser cookies.

## Mock integrations

- **Email:** `src/lib/email/mock-email.ts` writes to `email_sends`.
- **Payments:** `src/lib/payments/mock-payments.ts` returns fake references.

Replace with Resend/SendGrid and Stripe/PayMongo when ready.

## Auth

Admin and customer accounts are planned but not wired yet. The current `src/proxy.ts` (Next.js 16 network boundary) enforces a single shared `ADMIN_TOKEN` for `/admin/...` and `/api/admin/...` routes. Swap for a real session/identity provider (NextAuth/Clerk) when ready.

## Admin advisor

Founder-facing strategic chat at `/admin/advisor`, separate from the customer diagnostic intake. Uses `streamText` (free-form prose, not JSON schema), no caching, and a stronger model.

- **Model:** `OPENAI_ADVISOR_MODEL` (default `gpt-4.1`). Customer intake stays on `OPENAI_DIAGNOSTIC_MODEL` (default `gpt-4o-mini`) to keep the funnel cheap.
- **System prompt:** rendered from typed `AdvisorContext` in `apps/web/src/lib/ai/advisor-prompt.ts` — no `[INSERT NAME]` literals at runtime.
- **Auth:** set `ADMIN_TOKEN` to a long random string. Visit `/admin/login`, paste the token; the server sets an HttpOnly cookie. Unset in production yields 503; in development the gate is permissive so you can iterate locally.
