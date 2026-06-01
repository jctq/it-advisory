import type { BookingDocument, DiagnosticAnswers } from '@/domain/types';
import type { PaymentStatus } from '@/domain/payment-types';

export type DiagnosticSessionListRow = {
  readonly id: string;
  readonly visitorId: string;
  readonly currentStep: number;
  readonly updatedAtIso: string;
  readonly completedAtIso: string | null;
  readonly hasGuidedDiagnostic: boolean;
  readonly sessionTitlePreview: string | null;
  readonly situationPreview: string | null;
  readonly situationLabel: string | null;
  /** True when a booking references this session (`bookings.diagnosticSessionId`). */
  readonly isBooked: boolean;
  /** First linked booking id for admin, when `isBooked`. */
  readonly bookingId: string | null;
};

export type DiagnosticSessionLinkedBooking = {
  readonly id: string;
  readonly startsAtIso: string;
  readonly timezone: string;
  readonly serviceKey: string;
  readonly meetingUrl: string | null;
  readonly status: BookingDocument['status'];
  readonly recordingOptIn: boolean;
  readonly fathomShareUrl: string | null;
};

export type DiagnosticSessionDetail = {
  readonly id: string;
  readonly visitorId: string;
  readonly currentStep: number;
  readonly createdAtIso: string;
  readonly updatedAtIso: string;
  readonly completedAtIso: string | null;
  readonly guidedDiagnosticRaw: string | null;
  readonly situationDiagnosticThread: string | null;
  readonly linkedBookings: readonly DiagnosticSessionLinkedBooking[];
};

export type DiagnosticAuditAdminRow = {
  readonly id: string;
  readonly step: number;
  readonly createdAtIso: string;
  readonly answersJson: string;
};

export type { AccountBookingStatus, BookingListStatusFilter } from '@/lib/marketing/account-booking-status';

/** @deprecated Use {@link BookingListStatusFilter}. */
export type { BookingListStatusFilter as VisitorDiagnosticSessionListStatusFilter } from '@/lib/marketing/account-booking-status';

export type PaginatedVisitorDiagnosticSessionsResult = {
  readonly sessions: readonly VisitorDiagnosticSessionSummary[];
  readonly totalCount: number;
  readonly page: number;
  readonly pageSize: number;
  readonly totalPages: number;
  readonly hasAnySessions: boolean;
};

export type VisitorDiagnosticSessionSummary = {
  readonly id: string;
  /** Value for `/diagnostic/[sessionRef]` links and diagnostic session API calls (opaque when `DIAGNOSTIC_SESSION_URL_SECRET` is set). */
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
  readonly bookingPaymentStatus: PaymentStatus | null;
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

export type DeleteDiagnosticSessionForVisitorResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly code: 'not_found' };

export type UpsertDiagnosticProgressInput = {
  readonly visitorId: string;
  readonly answers: DiagnosticAnswers;
  readonly currentStep: number;
  readonly isComplete: boolean;
  /** When set, updates this session row after verifying `visitorId` ownership. */
  readonly targetSessionId?: string | null;
};

export type UpsertDiagnosticProgressResult = {
  readonly persisted: boolean;
  readonly sessionId?: string;
};

export { normalizeBookingListStatusFilter } from '@/lib/marketing/account-booking-status';

/** @deprecated Use {@link normalizeBookingListStatusFilter}. */
export { normalizeBookingListStatusFilter as normalizeVisitorDiagnosticSessionListStatusFilter } from '@/lib/marketing/account-booking-status';
