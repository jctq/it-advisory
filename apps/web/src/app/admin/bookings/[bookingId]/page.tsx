import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import {
  BOOKING_SESSION_CALENDAR_DURATION_MINUTES,
  buildBookingCalendarLinkBundle,
} from '@teqmd/domain/booking-calendar-links';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { AdminBookingDetailWorkspace } from '@/components/admin/admin-booking-detail-workspace';
import {
  resolveBookingDetailTab,
  type BookingDetailCalendarBundle,
} from '@/lib/admin/admin-detail-tab-routing';
import { syncBookingIfPaymentWindowExpired } from '@/lib/payments/cancel-expired-payment-window-bookings';
import { findBookingById } from '@/lib/data/bookings';
import { findPaymentTransactionById } from '@/lib/data/payment-transactions';
import { resolveAdminBookingOverviewContext } from '@/lib/admin/resolve-admin-booking-overview-context';
import { resolveBookingPaymentBreakdown } from '@/lib/payments/resolve-booking-payment-breakdown';
import { resolveCheckoutAmountCentavos } from '@/lib/payments/resolve-checkout-amount';
import { formatBookingReferenceId } from '@/lib/marketing/booking-reference';

type AdminBookingDetailPageProps = {
  readonly params: Promise<{ readonly bookingId: string }>;
  readonly searchParams: Promise<{ readonly tab?: string }>;
};

function formatServiceKeyLabel(serviceKey: string): string {
  const parts = serviceKey.split(/[-_]/).filter((part) => part.length > 0);
  if (parts.length === 0) {
    return 'Consultation';
  }
  return parts
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}`)
    .join(' ');
}

export default async function AdminBookingDetailPage(props: AdminBookingDetailPageProps) {
  const { bookingId } = await props.params;
  const searchParams = await props.searchParams;
  const initialTab = resolveBookingDetailTab(searchParams.tab?.trim());
  await syncBookingIfPaymentWindowExpired(bookingId);
  const booking = await findBookingById(bookingId);
  if (booking === null) {
    notFound();
  }
  const bookingReference = formatBookingReferenceId(booking.id);
  const startsAt = new Date(booking.startsAtIso);
  const meetingUrl =
    booking.meetingUrl !== undefined && typeof booking.meetingUrl === 'string' && booking.meetingUrl.trim().length > 0
      ? booking.meetingUrl.trim()
      : '';
  const recordingShareUrl =
    booking.fathomShareUrl !== undefined &&
    typeof booking.fathomShareUrl === 'string' &&
    booking.fathomShareUrl.trim().length > 0
      ? booking.fathomShareUrl.trim()
      : '';
  const catalogPricing = await resolveCheckoutAmountCentavos({
    serviceKey: booking.serviceKey,
    bookingId: null,
  });
  const linkedTransaction =
    booking.paymentTransactionId !== null ? await findPaymentTransactionById(booking.paymentTransactionId) : null;
  const paymentAmountCentavos =
    linkedTransaction?.amountCentavos ??
    (booking.quotedAmountCentavos !== null ? booking.quotedAmountCentavos : catalogPricing.amountCentavos);
  const paymentBreakdown = await resolveBookingPaymentBreakdown({
    booking,
    transaction: linkedTransaction,
    totalCentavos: paymentAmountCentavos,
  });
  const overview = await resolveAdminBookingOverviewContext(booking);
  let calendarBundle: BookingDetailCalendarBundle | null = null;
  if (booking.status === 'confirmed') {
    const built = buildBookingCalendarLinkBundle({
      title: `${formatServiceKeyLabel(booking.serviceKey)} — ${bookingReference}`,
      description: `Booking reference ${bookingReference}. Admin booking id ${booking.id}.`,
      location: meetingUrl,
      startsAtUtc: startsAt,
      durationMinutes: BOOKING_SESSION_CALENDAR_DURATION_MINUTES,
      icsUidSeed: bookingReference,
    });
    calendarBundle = {
      googleCalendarUrl: built.googleCalendarUrl,
      outlookCalendarUrl: built.outlookCalendarUrl,
      icsDataUrl: built.icsDataUrl,
      icsDownloadName: `booking-${bookingReference}.ics`,
    };
  }
  return (
    <section className="mx-auto space-y-8 w-full">
      <AdminPageHeader
        eyebrow="CRM"
        title="Booking details"
        description="Session schedule, client contact, payment, and the guided diagnostic captured at booking."
      />
      <div className="flex flex-wrap gap-3 text-sm">
        <Link href="/admin/bookings" className="font-medium text-primary underline-offset-4 hover:underline">
          ← All bookings
        </Link>
        <Link
          href={`/admin/debug?reference=${encodeURIComponent(bookingReference)}`}
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Client diagnostic
        </Link>
      </div>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading booking…</p>}>
        <AdminBookingDetailWorkspace
          initialTab={initialTab}
          booking={booking}
          meetingUrl={meetingUrl}
          recordingShareUrl={recordingShareUrl}
          paymentAmountCentavos={paymentAmountCentavos}
          paymentBreakdown={paymentBreakdown}
          catalogAmountLabel={catalogPricing.amountLabel}
          calendarBundle={calendarBundle}
          overview={overview}
        />
      </Suspense>
    </section>
  );
}
