import type { BookingDocument, QuizAnswers } from '@/domain/types';
import type { PaymentStatus } from '@/domain/payment-types';

export type QuizSessionListRow = {
  readonly id: string;
  readonly visitorId: string;
  readonly currentStep: number;
  readonly updatedAtIso: string;
  readonly completedAtIso: string | null;
  readonly hasGuidedDiagnostic: boolean;
  readonly sessionTitlePreview: string | null;
  readonly situationPreview: string | null;
  readonly situationLabel: string | null;
  /** True when a booking references this session (`bookings.quizSessionId`). */
  readonly isBooked: boolean;
  /** First linked booking id for admin, when `isBooked`. */
  readonly bookingId: string | null;
};

export type QuizSessionLinkedBooking = {
  readonly id: string;
  readonly startsAtIso: string;
  readonly timezone: string;
  readonly serviceKey: string;
  readonly meetingUrl: string | null;
  readonly status: BookingDocument['status'];
  readonly recordingOptIn: boolean;
  readonly fathomShareUrl: string | null;
};

export type QuizSessionDetail = {
  readonly id: string;
  readonly visitorId: string;
  readonly currentStep: number;
  readonly createdAtIso: string;
  readonly updatedAtIso: string;
  readonly completedAtIso: string | null;
  readonly guidedDiagnosticRaw: string | null;
  readonly situationDiagnosticThread: string | null;
  readonly linkedBookings: readonly QuizSessionLinkedBooking[];
};

export type QuizAuditAdminRow = {
  readonly id: string;
  readonly step: number;
  readonly createdAtIso: string;
  readonly answersJson: string;
};

export type { AccountBookingStatus, BookingListStatusFilter } from '@/lib/marketing/account-booking-status';

/** @deprecated Use {@link BookingListStatusFilter}. */
export type { BookingListStatusFilter as VisitorQuizSessionListStatusFilter } from '@/lib/marketing/account-booking-status';

export type PaginatedVisitorQuizSessionsResult = {
  readonly sessions: readonly VisitorQuizSessionSummary[];
  readonly totalCount: number;
  readonly page: number;
  readonly pageSize: number;
  readonly totalPages: number;
  readonly hasAnySessions: boolean;
};

export type VisitorQuizSessionSummary = {
  readonly id: string;
  /** Value for `/diagnostic/[sessionRef]` links and quiz session API calls (opaque when `QUIZ_SESSION_URL_SECRET` is set). */
  readonly marketingSessionRef: string;
  readonly currentStep: number;
  readonly updatedAtIso: string;
  readonly completedAtIso: string | null;
  readonly isDiagnosticComplete: boolean;
  readonly sessionTitlePreview: string | null;
  readonly situationPreview: string | null;
  readonly situationLabel: string | null;
  readonly hasGuidedDiagnostic: boolean;
  readonly isBooked: boolean;
  readonly bookingId: string | null;
  /** Display/search token derived from {@link bookingId} (last 8 hex chars, uppercase). */
  readonly bookingReferenceId: string | null;
  readonly bookingStatus: BookingDocument['status'] | null;
  readonly bookingStartsAtIso: string | null;
  readonly bookingTimezone: string | null;
  readonly bookingServiceKey: string | null;
  readonly bookingMeetingUrl: string | null;
  readonly paymentTransactionId: string | null;
  readonly paymentTransactionStatus: PaymentStatus | null;
  readonly checkoutStartsAtIso: string | null;
  readonly checkoutTimezone: string | null;
  readonly checkoutServiceKey: string | null;
};

export type DeleteQuizSessionForVisitorResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly code: 'not_found' };

export type UpsertQuizProgressInput = {
  readonly visitorId: string;
  readonly answers: QuizAnswers;
  readonly currentStep: number;
  readonly isComplete: boolean;
  /** When set, updates this session row after verifying `visitorId` ownership. */
  readonly targetSessionId?: string | null;
};

export type UpsertQuizProgressResult = {
  readonly persisted: boolean;
  readonly sessionId?: string;
};

export { normalizeBookingListStatusFilter } from '@/lib/marketing/account-booking-status';

/** @deprecated Use {@link normalizeBookingListStatusFilter}. */
export { normalizeBookingListStatusFilter as normalizeVisitorQuizSessionListStatusFilter } from '@/lib/marketing/account-booking-status';
