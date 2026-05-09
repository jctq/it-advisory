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
} as const;
