import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  BOOKING_SESSION_CALENDAR_DURATION_MINUTES,
  buildBookingCalendarLinkBundle,
} from '@techmd/domain/booking-calendar-links';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { BookingDiagnosticReadonly } from '@/components/admin/booking-diagnostic-readonly';
import { MarkBookingPaidButton } from '@/components/admin/mark-booking-paid-button';
import { findBookingById } from '@/lib/data/bookings';
import { formatBookingReferenceId } from '@/lib/marketing/booking-reference';

type AdminBookingDetailPageProps = {
  readonly params: Promise<{ readonly bookingId: string }>;
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
  const calendarBundle =
    booking.status === 'confirmed'
      ? buildBookingCalendarLinkBundle({
          title: `${formatServiceKeyLabel(booking.serviceKey)} — ${bookingReference}`,
          description: `Booking reference ${bookingReference}. Admin booking id ${booking.id}.`,
          location: meetingUrl,
          startsAtUtc: startsAt,
          durationMinutes: BOOKING_SESSION_CALENDAR_DURATION_MINUTES,
          icsUidSeed: bookingReference,
        })
      : null;
  return (
    <section className="mx-auto space-y-8">
      <AdminPageHeader
        eyebrow="CRM"
        title="Booking details"
        description="Service slot, visitor id, and the full guided diagnostic as captured at confirmation (every round, question, and option)."
      />
      <div className="flex flex-wrap gap-3 text-sm">
        <Link href="/admin/bookings" className="font-medium text-primary underline-offset-4 hover:underline">
          ← All bookings
        </Link>
      </div>
      <div className="rounded-2xl border border-border bg-card p-6 shadow-xs">
        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Booking id</dt>
            <dd className="mt-1 font-mono text-sm text-foreground">{booking.id}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Visitor</dt>
            <dd className="mt-1 font-mono text-sm text-foreground">{booking.visitorId}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Service</dt>
            <dd className="mt-1 text-sm text-foreground">{booking.serviceKey}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</dt>
            <dd className="mt-1 text-sm text-foreground">{booking.status}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Starts</dt>
            <dd className="mt-1 text-sm text-foreground">
              {new Date(booking.startsAtIso).toLocaleString('en-PH', { timeZone: booking.timezone })}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Timezone</dt>
            <dd className="mt-1 text-sm text-foreground">{booking.timezone}</dd>
          </div>
          {calendarBundle !== null ? (
            <div className="sm:col-span-2">
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Add to calendar</dt>
              <dd className="mt-2 flex flex-wrap gap-2 text-sm">
                <a
                  href={calendarBundle.googleCalendarUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  Google Calendar
                </a>
                <span className="text-muted-foreground">·</span>
                <a
                  href={calendarBundle.outlookCalendarUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  Outlook
                </a>
                <span className="text-muted-foreground">·</span>
                <a
                  href={calendarBundle.icsDataUrl}
                  download={`booking-${bookingReference}.ics`}
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  Apple (.ics)
                </a>
              </dd>
            </div>
          ) : null}
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Lead id</dt>
            <dd className="mt-1 font-mono text-sm text-foreground">{booking.leadId}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Diagnostic snapshot</dt>
            <dd className="mt-1 text-sm text-foreground">{booking.hasDiagnosticSnapshot ? 'Stored' : 'Not stored'}</dd>
          </div>
        </dl>
        <div className="mt-6">
          <MarkBookingPaidButton bookingId={booking.id} status={booking.status} />
        </div>
      </div>
      <div className="rounded-2xl border border-border bg-card p-6 shadow-xs">
        <h2 className="text-lg font-semibold text-foreground">Guided diagnostic</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Full question blocks and option lists as saved from the session at booking time.
        </p>
        <div className="mt-6">
          <BookingDiagnosticReadonly guidedDiagnosticRaw={booking.guidedDiagnosticSnapshot} />
        </div>
      </div>
    </section>
  );
}
