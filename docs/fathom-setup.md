# Fathom setup for consultation recordings

This app links [Fathom](https://www.fathom.ai/) meeting notes to confirmed bookings when customers opt in at checkout.

## 1. Fathom account (host)

1. Sign in to Fathom on the **same account** that hosts consultation calls.
2. Connect **Zoom**, **Google Meet**, and **Microsoft Teams** in Fathom integrations.
3. Enable **auto-join** with a **visible notetaker** (not bot-free-only mode for customer calls).

## 2. API access

1. In Fathom: **User Settings → API Access**.
2. Generate an **API key**.
3. Add a **webhook** with destination:
   - `{NEXT_PUBLIC_APP_URL}/api/webhooks/fathom`
4. Include **summary** and **action items** in the webhook payload when offered.

## 3. Admin → Settings → Recordings

1. Enable **consultation recordings**.
2. Set **opt-in price** (PHP). Use `0` for free opt-in.
3. Save **Fathom API key**, **webhook secret**, and **host email** (used to sanity-check matches).
4. Run **Test Fathom API** after saving.

Credentials are encrypted with `MEETINGS_CREDENTIALS_MASTER_KEY` (same as Meetings).

## 4. Customer flow

- Checkout shows an opt-in checkbox when recordings are enabled.
- Only opted-in bookings receive post-call note emails and manage-booking note links.
- Confirmation email includes a notetaker disclosure when the customer opted in.

## 5. Manual link (admin)

If auto-match fails (ambiguous title or time), open **Admin → Bookings → [booking]** and use **Manual link** with a Fathom recording id or share URL.

## Auto-match rules

1. **Booking reference in meeting title** (8-character code from calendar titles, e.g. Google Meet `Site · Service — AB12CD34`) links to a **confirmed** booking with **recording opt-in**, even when the call starts outside the scheduled slot.
2. Otherwise, match by **scheduled time** (± `FATHOM_MATCH_WINDOW_MINUTES`, default 15) and meeting title patterns.

## Troubleshooting

| Issue | Check |
|-------|--------|
| No webhook | URL reachable from internet; `FATHOM_ENABLED` not `0` |
| Unmatched booking | Title includes booking reference or start time within match window; use manual link |
| No customer email | Booking `recordingOptIn`; Fathom share URL present |
| API test fails | API key; Fathom plan includes API access |
