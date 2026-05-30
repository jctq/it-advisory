# Google Meet (Calendar API) setup

This project can create **Google Meet** join links for confirmed bookings by inserting a Google Calendar event with a Meet conference. The server uses **OAuth 2.0** with a **refresh token** (long-lived) plus your OAuth **client id** and **client secret**.

Related implementation:

- `apps/web/src/lib/google-meet/google-calendar-meet-api.ts` — refresh access token, create calendar event with Meet
- `apps/web/src/lib/data/meeting-settings.ts` — encrypts and stores `googleMeet` credentials in MongoDB
- Admin UI: **Settings → Meetings** (active provider **Google Meet**)

## Prerequisites

1. **Google Cloud project** with **Google Calendar API** enabled  
   APIs & Services → Library → “Google Calendar API” → Enable.

2. **OAuth consent screen** configured (user type External or Google Workspace Internal as appropriate).

3. **OAuth 2.0 Client ID** (type **Web application** or **Desktop**). Note the **Client ID** and **Client secret**.

4. **Authorized redirect URIs** (Web client) or the redirect you use for the auth flow must **exactly** match the `redirect_uri` in the authorization URL below.

5. Server env **`MEETINGS_CREDENTIALS_MASTER_KEY`** (min 32 characters) if you store credentials in Admin → Settings → Meetings (see `apps/web/.env.example`).

## Required credential fields

When saving **Google Meet** in Admin (or via `PATCH /api/admin/meeting-settings`), `providerCredentials.googleMeet` must include:

| Field           | Required | Description |
|-----------------|----------|-------------|
| `clientId`      | Yes      | OAuth 2.0 client id (`*.apps.googleusercontent.com`). |
| `clientSecret`  | Yes      | OAuth client secret. |
| `refreshToken`  | Yes      | From offline OAuth consent (see below). |
| `calendarId`  | No       | Calendar where events are created; defaults to `primary` if omitted. |

## Scopes

Use at least:

```text
https://www.googleapis.com/auth/calendar.events
```

That scope allows creating events (and Meet links) on the user’s calendar.

## Calendar invites for customers

When a paid booking is confirmed and Google Meet is the active provider, the server:

1. Creates a calendar event (with Meet) on the **OAuth calendar owner’s** account.
2. Adds the customer as an **attendee** (email from the booking lead or payment transaction).
3. Sends Google’s calendar invitation with `sendUpdates=all`.

The **organizer** shown in Google’s email is always the **Google account that owns the refresh token** (set that account’s display name to **TeqMD** in Google profile settings). Customers should accept the invite from that account rather than relying only on “Add to calendar” links in the TeqMD confirmation email (self-added events list the customer as organizer).

If no valid customer email is on the booking, the Meet link is still created but no Google calendar invite is emailed.

## Bookings vs “Test connection”

- **Paid, confirmed bookings** create a video link only for the **Active provider** selected at the top of Admin → Settings → Meetings (must **Save** after changing it).
- If **Active provider** is **None**, only **Zoom** environment variables are used for meetings — **not** Google Meet, even if Google credentials are saved or the Google test succeeds.
- **Test Google Meet connection** only proves refresh credentials work; it does **not** mean Meet is used for bookings until **Google Meet** is the active provider (or you rely on `GOOGLE_MEET_*` env **and** Google Meet is active — same rule).

## Authorization URL (get a `code`)

Build a URL like this (replace `YOUR_CLIENT_ID`, `YOUR_ENCODED_REDIRECT_URI`):

```text
https://accounts.google.com/o/oauth2/v2/auth?client_id=YOUR_CLIENT_ID&redirect_uri=YOUR_ENCODED_REDIRECT_URI&response_type=code&scope=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fcalendar.events&access_type=offline&prompt=consent
```

https://accounts.google.com/o/oauth2/v2/auth?client_id=716011573405-fbcr9an5h7aadd26rp7auds8vci2fkfo.apps.googleusercontent.com&redirect_uri=https%3A%2F%2Fit-advisory-production.up.railway.app%2F&response_type=code&scope=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fcalendar.events&access_type=offline&prompt=consent

Important query parameters:

| Parameter        | Value | Purpose |
|------------------|-------|---------|
| `access_type`    | `offline` | Allows a **refresh token** in the token response. |
| `prompt`         | `consent` | Helps ensure Google returns a refresh token again if you already authorized the app once. |
| `response_type`  | `code`  | Authorization code flow (server exchanges `code` for tokens). |
| `redirect_uri`   | Must match a URI registered on the OAuth client | **URL-encoded** in the query string. |

Example redirect (register this exact URI in Google Cloud): `http://localhost:8080/`  
Encoded: `http%3A%2F%2Flocalhost%3A8080%2F`

After you open the URL, sign in, and approve, the browser is redirected to your `redirect_uri` with a `code` query parameter. Copy that **`code`** (it expires quickly).

## Exchange `code` for tokens (get `refresh_token`)

`POST` to `https://oauth2.googleapis.com/token` with `Content-Type: application/x-www-form-urlencoded` and body:

```text
code=AUTHORIZATION_CODE
&client_id=YOUR_CLIENT_ID
&client_secret=YOUR_CLIENT_SECRET
&redirect_uri=http://localhost:8080/
&grant_type=authorization_code
```

`redirect_uri` must be the **same** string (not double-encoded) as in the authorization step.

The JSON response includes `access_token` and, when offline access was granted, **`refresh_token`**. Store **`refresh_token`** in Admin as `refreshToken` (or in `GOOGLE_MEET_REFRESH_TOKEN` for env fallback).

## OAuth 2.0 Playground (alternative)

1. Open [Google OAuth 2.0 Playground](https://developers.google.com/oauthplayground/).
2. Gear icon → **Use your own OAuth credentials** → enter client id and secret.
3. Select scope `https://www.googleapis.com/auth/calendar.events`.
4. **Authorize APIs** → sign in → **Exchange authorization code for tokens**.
5. Copy the **Refresh token** from the response.

If no refresh token appears, revoke the app under your Google account security settings for third-party access, or repeat the flow with `prompt=consent` in a manual auth URL, then try again.

## Environment variables (optional fallback)

When **Google Meet** is the active meeting provider, credentials can also come from env (see `apps/web/.env.example`):

| Variable | Description |
|----------|-------------|
| `GOOGLE_MEET_CLIENT_ID` | OAuth client id |
| `GOOGLE_MEET_CLIENT_SECRET` | OAuth client secret |
| `GOOGLE_MEET_REFRESH_TOKEN` | Refresh token |
| `GOOGLE_MEET_CALENDAR_ID` | Optional; default `primary` |

## Verify connection

In Admin → Settings → Meetings, use **Test Google Meet connection** after saving credentials, or call:

`PATCH /api/admin/meeting-settings` with body `{ "testProviderId": "googleMeet" }`.

On failure, the response **`message`** includes Google’s **`error`** and **`error_description`** when the token endpoint returns them (for example `invalid_grant: …`). A refresh failure is usually **wrong client id/secret**, **refresh token from another OAuth client**, or **revoked access** — not a missing Calendar scope (scope problems more often appear when **creating** the calendar event, not when refreshing).

## Troubleshooting: `403` — Calendar API not enabled

If server logs show something like:

`Google Calendar API has not been used in project … before or it is disabled`

then OAuth is working but **Calendar API is off** for the **same** Google Cloud project as your OAuth client:

1. Open the link from the log (or go to [Google Cloud Console](https://console.cloud.google.com/) → select the **same project** shown in the error message as your OAuth client).
2. **APIs & Services → Library** → search **Google Calendar API** → **Enable**.
3. Wait **a few minutes** for propagation, then confirm a **new** paid booking (or re-run whatever triggers Meet creation).

The **“Test Google Meet connection”** button only refreshes the access token; it does **not** call Calendar to create an event, so it can succeed while event creation still fails with `403` until the API is enabled.

## Troubleshooting: `Error 400: redirect_uri_mismatch`

You see this on **Google’s “Sign in with Google”** page when the **`redirect_uri`** sent in the authorization request is **not** listed exactly on your OAuth **Web client** (or does not match the client type rules for **Desktop** / **iOS** / **Android** clients).

1. In [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services** → **Credentials** → open the **OAuth 2.0 Client ID** you use for this flow.
2. Under **Authorized redirect URIs**, add the URI your app (or script) **actually sends** as `redirect_uri` — **character-for-character**:
   - Same scheme: **`https`** vs **`http`**
   - Same host: **`www`** vs apex, or custom domain vs default Vercel URL
   - Same path and **trailing slash** if present (e.g. `https://yourdomain.com/callback` vs `https://yourdomain.com/callback/`)
3. **Production vs local**: URIs you used for localhost **do not** apply to production. Add a **separate** entry for your live site (e.g. `https://app.yourdomain.com/api/.../callback` or whatever your auth library uses).
4. After saving in Google Cloud, wait a minute and retry.

To see the exact value Google rejected: open **error details** on Google’s error page, or inspect the first redirect to `accounts.google.com` and read the `redirect_uri=` query parameter — that string must appear in **Authorized redirect URIs**.

## Troubleshooting: `invalid_grant`

Google returns **`invalid_grant`** for several different mistakes. Match your step to the list below.

### A. You are exchanging an **authorization `code`** for tokens

Typical causes:

1. **Code expired or already used**  
   Authorization codes are **short-lived** (often about **10 minutes**) and **single-use**. Start a new browser auth flow, copy a **fresh** `code`, and exchange it **once** immediately.

2. **`redirect_uri` mismatch**  
   The `redirect_uri` in the **POST body** to `https://oauth2.googleapis.com/token` must be **byte-for-byte identical** to:
   - the `redirect_uri` you used in the **authorization URL**, and  
   - an **Authorized redirect URI** on the same OAuth client in Google Cloud.  
   Check **trailing slash** (`/` vs none), **http vs https**, **hostname** (`localhost` vs `127.0.0.1`), and **port**.

3. **Wrong `client_id` / `client_secret`**  
   The secret must belong to the **same** OAuth client that started the flow. If you rotated the secret in Cloud Console, use the **new** secret.

4. **OAuth Playground + your own Web client**  
   If you use [OAuth 2.0 Playground](https://developers.google.com/oauthplayground/) with **“Use your own OAuth credentials”**, add Google’s redirect URI to your **Web** client’s allowed list, exactly as documented for the Playground (typically `https://developers.google.com/oauthplayground` — confirm in Google’s Playground docs / gear UI).

### B. You are using a **refresh token** (this app’s “Test Google Meet connection”)

Our server calls the token endpoint with `grant_type=refresh_token`. Typical causes:

1. **Refresh token and client don’t belong together**  
   The refresh token was issued for a **specific** `client_id`. If you copy a refresh token from the Playground but save a **different** client id/secret in Admin, you get `invalid_grant`.

2. **Client secret rotated**  
   After rotating the secret in Google Cloud, old refresh tokens may still work **only** with the **new** secret — but if you paste the old secret, refresh fails. Use the current secret.

3. **User revoked access**  
   The user removed your app under Google Account → **Security** → Third-party connections. Run the consent flow again to obtain a **new** refresh token.

4. **Truncated or corrupted token**  
   Copy the full `refresh_token` string (no extra spaces or line breaks). Do not URL-encode the refresh token when pasting into JSON/env unless your tooling expects that.

5. **Publishing / verification (External apps)**  
   If the OAuth app is in **Testing**, only listed test users can complete consent; refresh may fail for others. **Expired** refresh tokens can also surface as `invalid_grant` after long disuse (rare for normal use).

### Quick checklist

- [ ] Same **OAuth client** (id + secret) for auth URL, code exchange, and stored refresh token.  
- [ ] **`redirect_uri`** exact match everywhere (auth URL, token POST, Cloud Console).  
- [ ] **New** `code` if exchanging; do not reuse.  
- [ ] **Full** `refresh_token` in Admin / `GOOGLE_MEET_REFRESH_TOKEN`.  
- [ ] User has **not** revoked the app; consent screen allows your account.

## Security

- Treat **client secret** and **refresh token** like passwords; store only in encrypted admin settings or secure env, never in client-side code or public repos.
- Rotate the client secret in Google Cloud if it is exposed.
- Restrict OAuth client redirect URIs to known hosts/paths.
