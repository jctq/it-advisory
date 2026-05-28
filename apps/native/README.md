# Native App

Expo / React Native app for the real native iOS and Android experience.

## Environment

Copy `.env.example` to `.env.local` and point `EXPO_PUBLIC_API_BASE_URL` at either:

- your Railway production URL, or
- a reachable LAN URL for local Next.js development

`http://localhost:3000` works for simulators, but not on a physical phone.

## Commands

```bash
pnpm --filter native install
pnpm --filter native run check-types
pnpm --filter native run ios
pnpm --filter native run android
```

## Current scope

- Native public funnel screens: home, diagnostic, service (post-diagnostic recommendation), booking, confirmation
- Anonymous device-backed quiz session persistence via `X-Device-Id`
- Shared business logic reused from `@techmd/diagnostic-core`
- Checkout sends `appBaseUrl` and `nativeInAppPaymentReturn` so the PSP lands on `/book/payment/native-close` (minimal HTML). That lets `openAuthSessionAsync` dismiss the in-app sheet instead of leaving the full “Confirming your payment…” React page running inside it.

## Support reports

Tap **Report** (floating button) on any screen that uses `AppScreen`. The app captures the current screen, lets the user describe the issue, and POSTs to `POST /api/support/report` on the web API.

Configure `SUPPORT_REPORT_TO` on the web server so reports are emailed to your team (requires transactional email in Admin → Settings → Email).

## Next likely steps

- Replace sample booking slots with real availability APIs
- Add lead capture and booking persistence
- Add production icons, launch screens, and store build profiles for Expo EAS
