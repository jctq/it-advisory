# TeqMD — Data Subject Request Runbook

**Purpose:** Operational guide for the DPO (`dpo@teqmd.ph`) when handling access, correction, erasure, portability, or objection requests under the TeqMD Privacy Policy and the Data Privacy Act of 2012.

**Audience:** DPO, authorized admin operators with MongoDB Atlas access.

**Related:** [Privacy Policy processor addendum](./privacy-policy-processor-addendum.md) · [Registration checklist](./teqmd-registration-checklist.md)

Generated: May 31, 2026

---

## 1. Before you touch data

### 1.1 Verify identity

1. Confirm the request is in writing to `dpo@teqmd.ph`.
2. Match the requester to at least **two** identifiers where possible:
   - Registered account email
   - Booking reference (e.g. `BK-…` from confirmation email)
   - Phone number used at checkout
   - Approximate consultation date
3. Do **not** disclose personal data until identity is verified.
4. Log the ticket: request type, date received, verification method, operator, outcome date (target: **15 business days** per policy).

### 1.2 Resolve the subject keys

TeqMD links activity through several keys. Resolve all that apply:

| Key | How to find it | Used by |
|-----|----------------|---------|
| **User id** | `users` where `emailNormalized` matches | Account profile |
| **Account visitor id** | `acct:<userIdHex>` (see `buildAccountVisitorId`) | Quiz, leads, bookings after sign-in / merge |
| **Anonymous visitor id** | Cookie `it_visitor_id` value if the user provides it; or infer from booking/quiz if never merged | Pre-login diagnostic and booking |
| **Lead id** | `bookings.leadId` → `leads._id` | Checkout contact fields |
| **Email (normalized)** | Lowercase trim | `users`, `leads.email`, `payment_transactions.customerEmail`, `email_sends.to`, `support_reports.reporterEmail` |

**After account merge:** guest rows are reassigned to `acct:<userId>` via `mergeVisitorIdentityIntoAccount`. Always search **both** the account visitor id and any legacy anonymous id the user remembers.

### 1.3 Legal holds and retention exceptions

Do **not** fully erase rows that must be kept for legal, tax, or audit reasons until the retention period ends. Instead **restrict processing** and **anonymize** where possible.

| Data class | Policy retention | Erasure approach |
|------------|------------------|------------------|
| Billing / payment records | 7 years | Anonymize PII fields; retain amounts, dates, gateway refs for tax |
| Client engagement / deliverables | 5 years from engagement end | Anonymize or redact after period; Fathom notes may live in Fathom until 2-year recording rule |
| Session recordings (Fathom) | 2 years from recording | Delete in Fathom admin/API; redact `fathom*` fields on booking |
| Active dispute / legal matter | Legal hold | Skip erasure until counsel clears |
| Marketing consent records | Relationship + 3 years | Retain proof of consent even after account erasure if required |

When in doubt, prefer **anonymization** over deletion for financial rows.

---

## 2. Request types — what to deliver

### 2.1 Access (Right to Access)

Export a single JSON or PDF bundle containing:

- `users` profile (email, fullName, company, phone — **never** password hash)
- All `quiz_sessions` + linked `quiz_audit` snapshots for the visitor id(s)
- `recommendations` for those sessions
- `leads` and `bookings` (including `guidedDiagnosticSnapshot`, recording opt-in, meeting metadata)
- `payment_transactions` linked by `visitorId` or `leadId`
- `support_reports` where `reporterUserId` or `reporterEmail` matches
- `email_sends` where `to` matches (subject + redacted payload)

Note: **Fathom recording content** may only exist on Fathom’s platform — export `fathomShareUrl` / `fathomSummary` from the booking and request a Fathom export separately if needed.

### 2.2 Correction (Right to Correction)

- Profile: user can self-serve at `/account/profile`; admin may patch `users` and run lead sync via existing profile sync flows.
- Booking contact: update `leads` and optionally `payment_transactions.customer*` for pending rows.
- Re-send corrected confirmation only after verifying identity.

### 2.3 Erasure / blocking

Follow **Section 3** below in order. Invalidate all sessions last.

### 2.4 Portability

Provide the **Access** export in JSON (machine-readable). Quiz answers and booking snapshots are already structured documents in MongoDB.

---

## 3. Collection-by-collection erasure checklist

Legend:

- **Delete** — remove documents or clear PII fields
- **Anonymize** — keep non-identifying business/tax fields
- **Retain** — no user PII; skip
- **External** — action outside MongoDB

Execute in roughly this order to avoid orphan references.

### 3.1 Identity and sessions

| Collection | PII fields | Match on | Action | Notes |
|------------|------------|----------|--------|-------|
| `user_auth_sessions` | `userId`, `tokenHash` | `userId` | **Delete** all rows for user | Ends all logins immediately |
| `users` | `emailNormalized`, `fullName`, `company`, `phone`, `passwordHash` | `_id` | **Delete** or **Anonymize** | Prefer delete for full erasure; use anonymized placeholder email if billing retention requires a stub |
| `visitor_sessions` | `visitorId` | `acct:…` and legacy guest id | **Delete** | Pointer to latest quiz session |

### 3.2 Diagnostic funnel

| Collection | PII fields | Match on | Action | Notes |
|------------|------------|----------|--------|-------|
| `quiz_sessions` | `visitorId`, `answers` (may include free text) | `visitorId` | **Delete** | App API: `deleteQuizSessionForVisitor` cancels active holds and removes session + audit for one session |
| `quiz_audit` | `visitorId`, `answersSnapshot` | `visitorId` or `sessionId` | **Delete** | Immutable history; delete all rows for subject sessions |
| `recommendations` | `visitorId`, `summary` | `visitorId` | **Delete** | |
| `diagnostic_round_cache` | Cached prompts/responses in `response` | Content-based | **Optional purge** | Not keyed by `visitorId`; shared semantic cache. Only purge if a specific prompt string is identified |
| `diagnostic_template_summary_cache` | Cached summaries | Content-based | **Optional purge** | Same as above |

### 3.3 Booking and CRM

| Collection | PII fields | Match on | Action | Notes |
|------------|------------|----------|--------|-------|
| `leads` | `name`, `email`, `company`, `phone`, `visitorId` | `visitorId` or `_id` from bookings | **Delete** or **Anonymize** | Anonymize if booking row kept for tax |
| `bookings` | `visitorId`, `meetingUrl`, `guidedDiagnosticSnapshot`, `fathomSummary`, `fathomShareUrl`, `fathomActionItems`, Zoom/Meet/Teams ids | `visitorId` or `leadId` | **Anonymize** PII fields; retain slot/status/amounts if within tax window | Cancel future bookings first |
| `payment_transactions` | `customerName`, `customerEmail`, `customerCompany`, `customerPhone`, `visitorId`, `metadata`, `rawWebhookPayload` | `visitorId`, `leadId`, `customerEmail` | **Anonymize** within 7-year window; **Delete** if outside window | Keep `amountCentavos`, `status`, `gatewayId`, dates |

### 3.4 Email and payment logs

| Collection | PII fields | Match on | Action | Notes |
|------------|------------|----------|--------|-------|
| `email_sends` | `to`, `payload` (names, booking refs) | `to` email | **Anonymize** `to` + redact `payload` | Template audit trail |
| `payment_logs` | `customerEmail`, `customerName`, `visitorId`, IP in `requestHeadersSummary` | `customerEmail`, `visitorId`, `transactionId` | **Anonymize** | Append-only admin log |

### 3.5 Support

| Collection | PII fields | Match on | Action | Notes |
|------------|------------|----------|--------|-------|
| `support_reports` | `message`, `reporterEmail`, `reporterUserId`, `reporterName`, `reporterMobile`, `deviceId`, `userAgent`, `screenshotData`, `replies[].authorEmail` | `reporterUserId`, `reporterEmail` | **Delete** entire report or redact PII fields | Binary screenshots count as personal data |

### 3.6 Recordings (Fathom)

| Location | PII | Match on | Action | Notes |
|----------|-----|----------|--------|-------|
| **Fathom (external)** | Audio/video/transcript | Booking time + host email + title | **External: delete** in Fathom | TeqMD stores ids/URLs/summaries only |
| `bookings` | `fathomRecordingId`, `fathomShareUrl`, `fathomSummary`, `fathomActionItems` | `bookingId` | **Unset** fields | After Fathom deletion |
| `fathom_webhook_deliveries` | `rawPayloadSnippet`, `fathomRecordingId` | `bookingId` or `fathomRecordingId` | **Delete** or redact snippet | Idempotency log |

### 3.7 Collections with no user PII (skip)

`advisor_booking_settings`, `app_settings`, `monetization_settings`, `payment_settings`, `email_settings`, `meeting_settings`, `recording_settings`, `seo_settings`, `support_settings`, `diagnostic_templates`, `blog_posts`, `blog_post_revisions`, `blog_images`, `testimonials`, `availability_slots`, `cron_job_runs`

---

## 4. Example MongoDB operations

Run in **MongoDB Atlas → Browse Collections** or `mongosh`. Replace placeholders.

```javascript
const email = "user@example.com".toLowerCase().trim();
const user = db.users.findOne({ emailNormalized: email });
const visitorIds = [];
if (user) visitorIds.push("acct:" + user._id.toString());
// Add legacy guest visitor id if known:
// visitorIds.push("abc123…");

// 1) Auth sessions
if (user) db.user_auth_sessions.deleteMany({ userId: user._id });

// 2) Quiz + audit
for (const vid of visitorIds) {
  const sessions = db.quiz_sessions.find({ visitorId: vid }, { _id: 1 }).toArray();
  const sessionIds = sessions.map((s) => s._id);
  db.quiz_audit.deleteMany({ visitorId: vid });
  db.quiz_audit.deleteMany({ sessionId: { $in: sessionIds } });
  db.quiz_sessions.deleteMany({ visitorId: vid });
  db.recommendations.deleteMany({ visitorId: vid });
  db.visitor_sessions.deleteMany({ visitorId: vid });
}

// 3) Leads + bookings
const leads = db.leads.find({ visitorId: { $in: visitorIds } }, { _id: 1 }).toArray();
const leadIds = leads.map((l) => l._id);
db.leads.deleteMany({ _id: { $in: leadIds } });
// Or anonymize leads instead of delete if retaining bookings for tax.

db.bookings.updateMany(
  { visitorId: { $in: visitorIds } },
  {
    $unset: {
      meetingUrl: "",
      guidedDiagnosticSnapshot: "",
      fathomRecordingId: "",
      fathomShareUrl: "",
      fathomSummary: "",
      fathomActionItems: "",
      zoomMeetingId: "",
      googleMeetEventId: "",
      teamsOnlineMeetingId: "",
    },
    $set: { updatedAt: new Date() },
  }
);

// 4) Payments — anonymize (example)
db.payment_transactions.updateMany(
  { $or: [{ visitorId: { $in: visitorIds } }, { customerEmail: email }] },
  {
    $set: {
      customerName: "[erased]",
      customerEmail: "[erased]",
      customerCompany: null,
      customerPhone: null,
      metadata: {},
      rawWebhookPayload: null,
      updatedAt: new Date(),
    },
  }
);

// 5) Email sends
db.email_sends.updateMany(
  { to: email },
  { $set: { to: "[erased]", payload: { redacted: true } } }
);

// 6) Support reports
db.support_reports.deleteMany({
  $or: [{ reporterEmail: email }, { reporterUserId: user ? user._id.toString() : "__none__" }],
});

// 7) User account (last)
if (user) db.users.deleteOne({ _id: user._id });
```

**Always** take an Atlas backup or export snapshot before bulk erasure in production.

---

## 5. Partial erasure (single diagnostic)

Users may ask to delete one assessment but keep their account.

- **Product support today:** signed-in users can remove sessions via account diagnostics UI, which calls `deleteQuizSessionForVisitor` (cancels slot holds, removes `quiz_sessions` + `quiz_audit` for that session, unlinks `bookings.quizSessionId`).
- **Operator:** confirm no confirmed paid booking depends on that session before deleting.

---

## 6. Third-party follow-up checklist

After MongoDB erasure, verify processors:

| Processor | Action |
|-----------|--------|
| **Fathom** | Delete recording(s) tied to booking; revoke share links |
| **Zoom / Google Meet / Microsoft Teams** | Delete or let meetings expire; remove calendar events if IDs stored on booking |
| **Payment gateway** (PayMongo, Xendit, HitPay, PayPal) | Customer data in dashboards may remain per their retention — request deletion if required |
| **Email provider** (Resend, Postmark, SendGrid) | Provider may retain delivery logs independently |
| **Google Analytics** | No per-user deletion in GA4 without User-ID setup; document if analytics was opt-in only |
| **OpenAI** | API data not used for training by default per OpenAI API terms; no per-request deletion API — document in response if prompts were sent |

---

## 7. Response template (erasure complete)

> We have completed your erasure request dated [DATE]. We removed or anonymized your account profile, diagnostic history, support reports, and linked booking contact fields in our primary database. Payment records required for tax compliance were anonymized but financial totals may be retained for [RETENTION END DATE]. Consultation recordings processed by our notetaker provider were [deleted / not applicable]. Some subprocessors may retain limited logs under their own policies; we notified [list] where applicable.

---

## 8. Known product gaps (track for engineering)

These items are **not** automated today — this runbook is the source of truth until built:

- [ ] No in-app “Delete my account” or privacy request form
- [ ] Registration `acceptedLegalTerms` is validated but **not persisted** with timestamp
- [ ] Cookie consent stored in browser `localStorage` only — not server-side
- [ ] No scheduled retention purge jobs (policy schedules in Privacy Policy §7)
- [ ] `diagnostic_round_cache` may retain prompt text without visitor linkage

---

*TeqMD / it-advisory monorepo — collection names from `packages/domain/src/collections.ts`.*
