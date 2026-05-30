# TeqMD — Registration & Setup Checklist

**Philippines-first technology advisory platform**  
Quiz → recommendation → booking, with admin CRM, payments, email, video meetings, and optional Fathom recordings.

Generated: May 30, 2026

---

## 1. Core platform (required for production)

| What to register / provision | Why | Where to configure |
|-------------------------------|-----|-------------------|
| **MongoDB Atlas** | All persisted data (quiz, leads, bookings, settings, logs) | `MONGODB_URI`, `MONGODB_DB_NAME` |
| **Hosting** (Railway recommended) | Runs Next.js API + marketing + admin | Deploy repo; set `NEXT_PUBLIC_APP_URL` |
| **Domain** (recommended) | Metadata, payment return URLs, webhooks, emails | `NEXT_PUBLIC_APP_URL`; optional `CHECKOUT_ALLOWED_APP_BASE_URLS` |

### Atlas extras (create in Atlas console)

- Network access for your host IPs
- Indexes: quiz_sessions, quiz_audit, visitor_sessions, leads, bookings (partial unique on serviceKey + startsAt), blog_posts, diagnostic_round_cache (vector index if using semantic cache)

### Server secrets (generate yourself — not third-party signups)

| Environment variable | Min length | Needed for |
|---------------------|------------|------------|
| `ADMIN_TOKEN` | long random string | `/admin` and `/api/admin/*` (503 in production if unset) |
| `PAYMENT_CREDENTIALS_MASTER_KEY` | 32+ characters | Saving payment API keys in Admin → Payments |
| `EMAIL_CREDENTIALS_MASTER_KEY` | 32+ characters | Saving email API keys in Admin → Email |
| `MEETINGS_CREDENTIALS_MASTER_KEY` | 32+ characters | Zoom / Meet / Teams + Fathom credentials |

**Optional but recommended:**

- `CRON_SECRET` — protects `POST /api/cron/payment-holds`
- `BOOKING_SESSION_ACCESS_SECRET` — signed links in confirmation emails
- `QUIZ_SESSION_URL_SECRET` — opaque quiz session URLs in marketing

### Scheduler

Register a **Railway Cron** (or equivalent) job:

```bash
pnpm --filter web cron:payment-holds
```

Use the same environment variables as the web service. Optional HTTP trigger:

```bash
curl -X POST "https://YOUR_APP/api/cron/payment-holds" \
  -H "Authorization: Bearer $CRON_SECRET"
```

---

## 2. Payment gateways (pick one or more)

Supported: **PayMongo**, **Xendit**, **HitPay**, **PayPal**

For each enabled provider:

1. Create a **business/developer account**
2. Obtain **API keys** (test + live as applicable)
3. Register **webhooks** at your public app URL

### Webhook URLs

| Gateway | Webhook URL |
|---------|-------------|
| PayMongo | `{APP_URL}/api/webhooks/paymongo` |
| Xendit | `{APP_URL}/api/webhooks/xendit` |
| HitPay | `{APP_URL}/api/webhooks/hitpay` |
| PayPal | `{APP_URL}/api/webhooks/paypal` |

### Admin → Settings → Payments — credential fields

| Gateway | Fields to save |
|---------|----------------|
| PayMongo | `secretKey`, optional `secretKeyTest`, `webhookSecret` |
| Xendit | `secretKey`, `webhookToken` |
| HitPay | `apiKey`, optional `apiKeyTest`, `salt` |
| PayPal | `clientId`, `clientSecret` |

Also configure: payments on/off, policy (`pay_after_hold` vs `manual_confirm`), hold window, checkout amount, sandbox mode.

**Development:** Without gateway credentials, checkout uses a mock adapter when `NODE_ENV=development`.

---

## 3. Transactional email (pick one provider)

Providers: **Resend**, **Postmark**, **SendGrid** — Admin → Settings → Email

| Provider | Register | Admin credentials | Env fallback |
|----------|----------|-------------------|--------------|
| **Resend** | Account + verified sending domain | `apiKey`, `from` | `RESEND_API_KEY` + `EMAIL_FROM` when active provider is None |
| **Postmark** | Server + verified domain | `serverToken`, `from` | — |
| **SendGrid** | Account + verified sender/domain | `apiKey`, `from` | — |

**Optional env:**

- `BOOKING_CONFIRMATION_BCC` — BCC on booking confirmations
- `EMAIL_SANDBOX_TO` — when admin Sandbox mode is on (e.g. `delivered@resend.dev`)

**Emails sent:** booking confirmation, payment reminder, Fathom meeting notes, support-report staff notifications.

---

## 4. Video meetings (pick one active provider)

Admin → Settings → **Meetings**. Only the **active** provider provisions links for paid bookings.

| Provider | Register | Admin credential fields | Env fallback |
|----------|----------|-------------------------|--------------|
| **Zoom** | Zoom Marketplace Server-to-Server OAuth app; licensed host | `accountId`, `clientId`, `clientSecret`, `hostUserId` | `ZOOM_ACCOUNT_ID`, `ZOOM_CLIENT_ID`, `ZOOM_CLIENT_SECRET`, `ZOOM_HOST_USER_ID` |
| **Google Meet** | Google Cloud project, Calendar API, OAuth offline refresh token | `clientId`, `clientSecret`, `refreshToken`, optional `calendarId` | `GOOGLE_MEET_*` (see `docs/google-meet-oauth-setup.md`) |
| **Microsoft Teams** | Azure AD app, admin consent, Graph permissions | `tenantId`, `clientId`, `clientSecret`, `organizerUserId` | `MICROSOFT_TEAMS_*` |

**Note:** If active provider is **None**, only Zoom environment variables are used (legacy). Google Meet and Teams must be selected as active.

---

## 5. Consultation recordings (Fathom)

Admin → Settings → **Recordings** — see `docs/fathom-setup.md`

| Step | Action |
|------|--------|
| Fathom account | Same account that hosts calls; connect Zoom/Meet/Teams; enable visible notetaker |
| API access | Generate API key (User Settings → API Access) |
| Webhook | `{NEXT_PUBLIC_APP_URL}/api/webhooks/fathom` |

**Admin fields:** `apiKey`, `webhookSecret`, `hostEmail`; enable recordings + opt-in price.

**Env fallback:** `FATHOM_API_KEY`, `FATHOM_WEBHOOK_SECRET`, `FATHOM_HOST_EMAIL`, `FATHOM_MATCH_WINDOW_MINUTES`, `FATHOM_ENABLED`

Uses `MEETINGS_CREDENTIALS_MASTER_KEY` for credential encryption.

---

## 6. AI — OpenAI (optional but needed for full quiz/advisor)

| Feature | Environment variables |
|---------|----------------------|
| Guided diagnostic rounds | `OPENAI_API_KEY`, optional `OPENAI_DIAGNOSTIC_MODEL` (default `gpt-4o-mini`) |
| Admin advisor chat | `OPENAI_API_KEY`, optional `OPENAI_ADVISOR_MODEL` (default `gpt-4.1`) |
| Semantic diagnostic cache | `OPENAI_API_KEY`, Atlas Vector Search index, `DIAGNOSTIC_CACHE_VECTOR_INDEX_NAME` |

Register: OpenAI platform account, API key, billing enabled.

---

## 7. Analytics

| Register | Environment variable |
|----------|---------------------|
| Google Analytics 4 property | `NEXT_PUBLIC_GA_MEASUREMENT_ID` |

Analytics loads only after cookie consent for the analytics category.

---

## 8. Support reports

No separate SaaS — uses your transactional email stack.

| Config | Location |
|--------|----------|
| Staff notification inboxes | Admin → Settings → Support |
| Env fallback | `SUPPORT_REPORT_TO` |

---

## 9. Customer accounts

Marketing login/register is **built-in** (email + password stored in MongoDB). No Clerk, Auth0, or similar required unless you add one later.

---

## 10. Native app (Expo)

| Register | Notes |
|----------|-------|
| Apple Developer Program | `EXPO_PUBLIC_IOS_BUNDLE_ID` (default `com.techmd.native`) |
| Google Play Console | `EXPO_PUBLIC_ANDROID_PACKAGE` |
| Expo (optional) | If using EAS builds |

Set `EXPO_PUBLIC_API_BASE_URL` in `apps/native/.env.local` to your deployed web API.

---

## 11. CMS / legal pages

- Blog: Admin → Blog (MongoDB — no external CMS)
- Optional legal embeds: `PRIVACY_POLICY_BLOG_POST_ID`, `TERMS_OF_USE_BLOG_POST_ID`
- **Customer-facing privacy addendum:** [Processor & feature addendum](./privacy-policy-processor-addendum.md) (paste into CMS policy as Section 5.1.1)
- **DPO / ops:** [Data subject erasure runbook](./data-subject-erasure-checklist.md)

---

## Admin Settings → external services (quick reference)

| Admin tab | External registrations |
|-----------|------------------------|
| General | Brand/site name (in database) |
| Pricing | None — catalog in MongoDB |
| Payments | PayMongo / Xendit / HitPay / PayPal |
| Email | Resend / Postmark / SendGrid + domain verification |
| Support | Email delivery (same provider as above) |
| Meetings | Zoom / Google Cloud / Microsoft Entra |
| Recordings | Fathom |

---

## Recommended go-live order

1. Atlas + hosting + `NEXT_PUBLIC_APP_URL` + master keys + `ADMIN_TOKEN`
2. One payment gateway + webhooks + Payments settings + payment-holds cron
3. One email provider + verified domain + Email settings (disable sandbox when ready)
4. One meeting provider + test booking end-to-end
5. OpenAI if you want live diagnostics and advisor chat
6. GA4 if you want marketing analytics
7. Fathom only if you offer recording opt-in at checkout
8. App Store / Play Store when shipping native builds

---

*TeqMD / it-advisory monorepo — `apps/web/.env.example` is the authoritative env template.*
