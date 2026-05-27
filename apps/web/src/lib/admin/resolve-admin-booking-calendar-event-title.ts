import type { AdminBookingCalendarRow } from '@/lib/data/bookings';
import { formatBookingReferenceId } from '@/lib/marketing/booking-reference';
import { resolveAccountDiagnosticListTitle } from '@/lib/marketing/quiz-session-list-display';

function formatServiceKeyLabel(serviceKey: string): string {
  const parts = serviceKey.split(/[-_]/).filter((part) => part.length > 0);
  if (parts.length === 0) {
    return 'Consultation';
  }
  return parts
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}`)
    .join(' ');
}

function isGenericDiagnosticListTitle(title: string): boolean {
  return title === 'Diagnostic session' || title === 'Guided diagnostic';
}

/**
 * FullCalendar event title for admin bookings — matches account "My diagnostics" session labels.
 */
export function resolveAdminBookingCalendarEventTitle(booking: AdminBookingCalendarRow): string {
  const bookingReference = formatBookingReferenceId(booking.id);
  const diagnosticTitle = resolveAccountDiagnosticListTitle({
    sessionTitlePreview: booking.sessionTitlePreview,
    situationPreview: booking.situationPreview,
    bookingReferenceId: bookingReference,
    hasGuidedDiagnostic: booking.hasDiagnosticSnapshot,
  });
  if (!isGenericDiagnosticListTitle(diagnosticTitle)) {
    return diagnosticTitle;
  }
  return `${formatServiceKeyLabel(booking.serviceKey)} · ${bookingReference}`;
}
