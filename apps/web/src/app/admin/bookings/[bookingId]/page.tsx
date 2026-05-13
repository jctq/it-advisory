import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { BookingDiagnosticReadonly } from '@/components/admin/booking-diagnostic-readonly';
import { findBookingById } from '@/lib/data/bookings';

type AdminBookingDetailPageProps = {
  readonly params: Promise<{ readonly bookingId: string }>;
};

export default async function AdminBookingDetailPage(props: AdminBookingDetailPageProps) {
  const { bookingId } = await props.params;
  const booking = await findBookingById(bookingId);
  if (booking === null) {
    notFound();
  }
  return (
    <section className="mx-auto max-w-4xl space-y-8">
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
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Lead id</dt>
            <dd className="mt-1 font-mono text-sm text-foreground">{booking.leadId}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Diagnostic snapshot</dt>
            <dd className="mt-1 text-sm text-foreground">{booking.hasDiagnosticSnapshot ? 'Stored' : 'Not stored'}</dd>
          </div>
        </dl>
      </div>
      <div className="rounded-2xl border border-border bg-card p-6 shadow-xs">
        <h2 className="text-lg font-semibold text-foreground">Guided diagnostic</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Full question blocks and option lists as saved from the quiz session at booking time.
        </p>
        <div className="mt-6">
          <BookingDiagnosticReadonly guidedDiagnosticRaw={booking.guidedDiagnosticSnapshot} />
        </div>
      </div>
    </section>
  );
}
