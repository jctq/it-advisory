import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ObjectId } from 'mongodb';
import { Suspense } from 'react';
import {
  BOOKING_SESSION_CALENDAR_DURATION_MINUTES,
  buildBookingCalendarLinkBundle,
} from '@techmd/domain/booking-calendar-links';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { AdminSessionDetailWorkspace } from '@/components/admin/admin-session-detail-workspace';
import {
  listAvailableSessionDetailTabs,
  resolveSessionDetailTab,
  type SessionCheckoutTransaction,
  type SessionLinkedBookingRow,
} from '@/lib/admin/admin-detail-tab-routing';
import { findLatestPaymentTransactionByQuizSessionIdHex, findPaymentTransactionById } from '@/lib/data/payment-transactions';
import { reconcilePaymentTransactionById } from '@/lib/payments/reconcile-visitor-payments';
import { findQuizSessionById, listQuizAuditForSession } from '@/lib/data/quiz-sessions';
import { formatBookingReferenceId } from '@/lib/marketing/booking-reference';

type AdminQuizSessionDetailPageProps = {
  readonly params: Promise<{ readonly sessionId: string }>;
  readonly searchParams: Promise<{ readonly tab?: string }>;
};

export const metadata = {
  title: 'Session — TechMD Admin',
};

export const dynamic = 'force-dynamic';

function formatServiceKeyLabel(serviceKey: string): string {
  const parts = serviceKey.split(/[-_]/).filter((part) => part.length > 0);
  if (parts.length === 0) {
    return 'Consultation';
  }
  return parts
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}`)
    .join(' ');
}

export default async function AdminQuizSessionDetailPage(props: AdminQuizSessionDetailPageProps) {
  const { sessionId } = await props.params;
  const searchParams = await props.searchParams;
  const session = await findQuizSessionById(sessionId);
  if (session === null) {
    notFound();
  }
  const auditRows = await listQuizAuditForSession(new ObjectId(session.id));
  let checkoutTransaction = await findLatestPaymentTransactionByQuizSessionIdHex(session.id);
  if (checkoutTransaction !== null) {
    await reconcilePaymentTransactionById(checkoutTransaction.id);
    checkoutTransaction = (await findPaymentTransactionById(checkoutTransaction.id)) ?? checkoutTransaction;
  }
  const availableTabs = listAvailableSessionDetailTabs({
    hasCheckoutTransaction: checkoutTransaction !== null,
    linkedBookingCount: session.linkedBookings.length,
    hasDiagnosticThread: session.situationDiagnosticThread !== null,
    auditRowCount: auditRows.length,
  });
  const initialTab = resolveSessionDetailTab(searchParams.tab?.trim(), availableTabs);
  const linkedBookingRows: SessionLinkedBookingRow[] = session.linkedBookings.map((booking) => {
    const bookingReference = formatBookingReferenceId(booking.id);
    const startsAt = new Date(booking.startsAtIso);
    const meetingUrl =
      booking.meetingUrl !== null && booking.meetingUrl.trim().length > 0 ? booking.meetingUrl.trim() : '';
    if (booking.status !== 'confirmed') {
      return { ...booking, calendarBundle: null };
    }
    const built = buildBookingCalendarLinkBundle({
      title: `${formatServiceKeyLabel(booking.serviceKey)} — ${bookingReference}`,
      description: `Booking reference ${bookingReference}. Session ${session.id}.`,
      location: meetingUrl,
      startsAtUtc: startsAt,
      durationMinutes: BOOKING_SESSION_CALENDAR_DURATION_MINUTES,
      icsUidSeed: bookingReference,
    });
    return {
      ...booking,
      calendarBundle: {
        googleCalendarUrl: built.googleCalendarUrl,
        outlookCalendarUrl: built.outlookCalendarUrl,
        icsDataUrl: built.icsDataUrl,
        icsDownloadName: `booking-${bookingReference}.ics`,
      },
    };
  });
  const checkoutTransactionPayload: SessionCheckoutTransaction | null =
    checkoutTransaction === null
      ? null
      : {
          id: checkoutTransaction.id,
          status: checkoutTransaction.status,
          gatewayId: checkoutTransaction.gatewayId,
          amountCentavos: checkoutTransaction.amountCentavos,
          bookingId: checkoutTransaction.bookingId,
          customerEmail: checkoutTransaction.customerEmail,
        };
  return (
    <section className="mx-auto space-y-8 w-full">
      <AdminPageHeader
        eyebrow="Intake"
        title="Session"
        description="Visitor diagnostic snapshot from database. Booked = a booking row points at this session id. Use tabs for payment, linked bookings, diagnostic thread, guided diagnostic, and save history."
      />
      <div className="flex flex-wrap gap-3 text-sm">
        <Link href="/admin/sessions" className="font-medium text-primary underline-offset-4 hover:underline">
          ← All sessions
        </Link>
        <Link
          href={`/admin/debug?diagnostic=${encodeURIComponent(session.id)}`}
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Client diagnostic
        </Link>
      </div>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading session…</p>}>
        <AdminSessionDetailWorkspace
          initialTab={initialTab}
          session={session}
          auditRows={auditRows}
          checkoutTransaction={checkoutTransactionPayload}
          linkedBookingRows={linkedBookingRows}
        />
      </Suspense>
    </section>
  );
}
