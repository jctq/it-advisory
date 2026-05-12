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

- Native public funnel screens: home, diagnostic, recommendation, service, booking, confirmation
- Anonymous device-backed quiz session persistence via `X-Device-Id`
- Shared business logic reused from `@it-advisory/diagnostic-core`

## Next likely steps

- Replace sample booking slots with real availability APIs
- Add lead capture and booking persistence
- Add production icons, launch screens, and store build profiles for Expo EAS
