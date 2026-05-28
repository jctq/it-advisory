import type { PaymentGatewayId, PaymentStatus } from '@/domain/payment-types';
import type { QuizSessionLinkedBooking } from '@/lib/data/quiz-session-types';

export type BookingDetailTab = 'overview' | 'payment' | 'recording' | 'quote' | 'diagnostic';

export type BookingDetailCalendarBundle = {
  readonly googleCalendarUrl: string;
  readonly outlookCalendarUrl: string;
  readonly icsDataUrl: string;
  readonly icsDownloadName: string;
};

export function resolveBookingDetailTab(value: string | undefined): BookingDetailTab {
  if (value === 'fathom') {
    return 'recording';
  }
  if (value === 'payment' || value === 'recording' || value === 'quote' || value === 'diagnostic') {
    return value;
  }
  return 'overview';
}

export type SessionDetailTab =
  | 'overview'
  | 'payment'
  | 'linked-bookings'
  | 'diagnostic-thread'
  | 'guided-diagnostic'
  | 'save-history';

export type SessionLinkedBookingCalendarBundle = {
  readonly googleCalendarUrl: string;
  readonly outlookCalendarUrl: string;
  readonly icsDataUrl: string;
  readonly icsDownloadName: string;
};

export type SessionLinkedBookingRow = QuizSessionLinkedBooking & {
  readonly calendarBundle: SessionLinkedBookingCalendarBundle | null;
};

export type SessionCheckoutTransaction = {
  readonly id: string;
  readonly status: PaymentStatus;
  readonly gatewayId: PaymentGatewayId;
  readonly amountCentavos: number;
  readonly bookingId: string | null;
  readonly customerEmail: string | null;
};

export function listAvailableSessionDetailTabs(input: {
  readonly hasCheckoutTransaction: boolean;
  readonly linkedBookingCount: number;
  readonly hasDiagnosticThread: boolean;
  readonly auditRowCount: number;
}): readonly SessionDetailTab[] {
  const tabValues: SessionDetailTab[] = ['overview'];
  if (input.hasCheckoutTransaction) {
    tabValues.push('payment');
  }
  if (input.linkedBookingCount > 0) {
    tabValues.push('linked-bookings');
  }
  if (input.hasDiagnosticThread) {
    tabValues.push('diagnostic-thread');
  }
  tabValues.push('guided-diagnostic');
  if (input.auditRowCount > 0) {
    tabValues.push('save-history');
  }
  return tabValues;
}

export function resolveSessionDetailTab(
  value: string | undefined,
  availableTabs: readonly SessionDetailTab[],
): SessionDetailTab {
  if (value !== undefined && availableTabs.includes(value as SessionDetailTab)) {
    return value as SessionDetailTab;
  }
  return 'overview';
}
