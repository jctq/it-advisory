/** Logical MongoDB collection names — align indexes and validators with these constants. */
export const COLLECTIONS = {
  quizSessions: 'quiz_sessions',
  quizAudit: 'quiz_audit',
  visitorSessions: 'visitor_sessions',
  recommendations: 'recommendations',
  leads: 'leads',
  bookings: 'bookings',
  availabilitySlots: 'availability_slots',
  emailSends: 'email_sends',
  users: 'users',
  /** Diagnostic cache for `/api/quiz/diagnostic-round`: unique `{ threadHash: 1 }`; Vector Search on `embedding` optional. */
  diagnosticRoundCache: 'diagnostic_round_cache',
  /** Singleton `{ _id: 'app' }` — diagnostic quiz tuning (admin). */
  appSettings: 'app_settings',
} as const;
