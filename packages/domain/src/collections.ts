/** Logical MongoDB collection names — align indexes and validators with these constants. */
export const COLLECTIONS = {
  quizSessions: 'quiz_sessions',
  quizAudit: 'quiz_audit',
  visitorSessions: 'visitor_sessions',
  recommendations: 'recommendations',
  leads: 'leads',
  bookings: 'bookings',
  /** Singleton advisor booking rules + caps (`_id: 'default'`). */
  advisorBookingSettings: 'advisor_booking_settings',
  availabilitySlots: 'availability_slots',
  emailSends: 'email_sends',
  /** Singleton `{ _id: 'default' }` — transactional email providers (admin). */
  emailSettings: 'email_settings',
  users: 'users',
  /** Opaque bearer sessions for marketing-site accounts (`it_auth_session` cookie). */
  userAuthSessions: 'user_auth_sessions',
  /** Diagnostic cache for `/api/quiz/diagnostic-round`: unique `{ threadHash: 1 }`; Vector Search on `embedding` optional. */
  diagnosticRoundCache: 'diagnostic_round_cache',
  /** Exact-match cache for `/api/quiz/diagnostic-template-summary`: unique `{ threadHash: 1 }`. */
  diagnosticTemplateSummaryCache: 'diagnostic_template_summary_cache',
  /** Admin-managed diagnostic templates with nested rounds/questions/options. */
  diagnosticTemplates: 'diagnostic_templates',
  /** Singleton `{ _id: 'app' }` — diagnostic quiz tuning (admin). */
  appSettings: 'app_settings',
  /** Singleton `{ _id: 'default' }` — service catalog, packages, and promo codes (admin). */
  monetizationSettings: 'monetization_settings',
  /** Singleton `{ _id: 'default' }` — payment gateways and checkout policy (admin). */
  paymentSettings: 'payment_settings',
  paymentTransactions: 'payment_transactions',
  /** Singleton `{ _id: 'default' }` — video meeting providers (Zoom, etc.) for booking links (admin). */
  meetingSettings: 'meeting_settings',
  /** Singleton `{ _id: 'default' }` — consultation recording / Fathom (admin). */
  recordingSettings: 'recording_settings',
  /** Idempotent log of inbound Fathom webhook deliveries. */
  fathomWebhookDeliveries: 'fathom_webhook_deliveries',
  /** Admin-managed blog posts (markdown CMS for marketing site). */
  blogPosts: 'blog_posts',
  /** Admin-managed client quotes for the marketing homepage testimonials band. */
  testimonials: 'testimonials',
  /** Append-only save history for blog post edits (field snapshots for diffs). */
  blogPostRevisions: 'blog_post_revisions',
  /** Uploaded images for blog post markdown (paste / insert in admin editor). */
  blogImages: 'blog_images',
  /** Append-only log of `/api/cron/*` invocations (admin). */
  cronJobRuns: 'cron_job_runs',
  /** Append-only log of inbound payment gateway events (admin). */
  paymentLogs: 'payment_logs',
  /** User-submitted support / bug reports with optional screenshots. */
  supportReports: 'support_reports',
  /** Singleton `{ _id: 'default' }` — support notification emails and reporter email policy. */
  supportSettings: 'support_settings',
} as const;
