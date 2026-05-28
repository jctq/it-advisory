'use client';

import Link from 'next/link';
import {
  ClipboardList,
  CreditCard,
  LayoutDashboard,
  Receipt,
  Video,
  type LucideIcon,
} from 'lucide-react';
import { type ReactElement } from 'react';
import { BookingDiagnosticReadonly } from '@/components/admin/booking-diagnostic-readonly';
import { AdminBookingFathomSection } from '@/components/admin/admin-booking-fathom-section';
import { AdminFathomNotesLink } from '@/components/admin/admin-fathom-notes-link';
import { AdminBookingPaymentSection } from '@/components/admin/admin-booking-payment-section';
import { AdminBookingQuoteForm } from '@/components/admin/admin-booking-quote-form';
import { AdminBookingStatusForm } from '@/components/admin/admin-booking-status-form';
import { AdminDetailTabsShell, type AdminDetailTabConfig } from '@/components/admin/admin-detail-tabs-shell';
import { MarkBookingPaidButton } from '@/components/admin/mark-booking-paid-button';
import { resolveBookingDetailTab, type BookingDetailCalendarBundle, type BookingDetailTab } from '@/lib/admin/admin-detail-tab-routing';
import type { BookingDetailRow } from '@/lib/data/bookings';

export type { BookingDetailCalendarBundle, BookingDetailTab } from '@/lib/admin/admin-detail-tab-routing';

type BookingDetailTabConfig = AdminDetailTabConfig<BookingDetailTab> & {
  readonly icon: LucideIcon;
};

const BOOKING_DETAIL_TABS: readonly BookingDetailTabConfig[] = [
  { value: 'overview', label: 'Overview', icon: LayoutDashboard },
  { value: 'payment', label: 'Payment', icon: CreditCard },
  { value: 'recording', label: 'Recording', icon: Video },
  { value: 'quote', label: 'Quote', icon: Receipt },
  { value: 'diagnostic', label: 'Diagnostic', icon: ClipboardList },
];

type AdminBookingDetailWorkspaceProps = {
  readonly initialTab: BookingDetailTab;
  readonly booking: BookingDetailRow;
  readonly meetingUrl: string;
  readonly recordingShareUrl: string;
  readonly paymentAmountCentavos: number;
  readonly catalogAmountLabel: string;
  readonly calendarBundle: BookingDetailCalendarBundle | null;
};

function renderOverviewPanel(props: AdminBookingDetailWorkspaceProps): ReactElement {
  const { booking, meetingUrl, recordingShareUrl, calendarBundle } = props;
  const startsAt = new Date(booking.startsAtIso);
  return (
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
        <div className="sm:col-span-2">
          <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</dt>
          <dd className="mt-2">
            <AdminBookingStatusForm
              bookingId={booking.id}
              initialStatus={booking.status}
              paymentExpiresAtIso={booking.paymentExpiresAtIso}
            />
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Starts</dt>
          <dd className="mt-1 text-sm text-foreground">
            {startsAt.toLocaleString('en-PH', { timeZone: booking.timezone })}
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
                download={calendarBundle.icsDownloadName}
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
        {booking.quizSessionId !== null ? (
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Quiz session</dt>
            <dd className="mt-1 text-sm">
              <Link
                href={`/admin/sessions/${booking.quizSessionId}`}
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                View session
              </Link>
            </dd>
          </div>
        ) : null}
        {meetingUrl.length > 0 ? (
          <div className="sm:col-span-2">
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Video meeting</dt>
            <dd className="mt-1 text-sm">
              <a
                href={meetingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                Join meeting
              </a>
            </dd>
          </div>
        ) : null}
        {recordingShareUrl.length > 0 || booking.recordingOptIn ? (
          <div className="sm:col-span-2">
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Meeting notes</dt>
            <dd className="mt-1 text-sm">
              <AdminFathomNotesLink
                fathomShareUrl={recordingShareUrl.length > 0 ? recordingShareUrl : null}
                recordingOptIn={booking.recordingOptIn}
              />
            </dd>
          </div>
        ) : null}
      </dl>
      <div className="mt-6 flex flex-wrap gap-3">
        <MarkBookingPaidButton bookingId={booking.id} status={booking.status} />
      </div>
    </div>
  );
}

export function AdminBookingDetailWorkspace(props: AdminBookingDetailWorkspaceProps): ReactElement {
  const basePath = `/admin/bookings/${props.booking.id}`;
  return (
    <AdminDetailTabsShell<BookingDetailTab>
      tabs={BOOKING_DETAIL_TABS}
      initialTab={props.initialTab}
      defaultTab="overview"
      resolveTab={resolveBookingDetailTab}
      ariaLabel="Booking detail sections"
      basePath={basePath}
      shouldOmitTabFromUrl={(tab) => tab === 'overview'}
      renderPanel={(tab) => {
        if (tab === 'overview') {
          return renderOverviewPanel(props);
        }
        if (tab === 'payment') {
          return (
            <AdminBookingPaymentSection
              bookingId={props.booking.id}
              paymentTransactionId={props.booking.paymentTransactionId}
              paymentStatus={props.booking.paymentStatus}
              paymentGatewayId={props.booking.paymentGatewayId}
              paymentMethodLabel={props.booking.paymentMethodLabel}
              paymentProviderRef={props.booking.paymentProviderRef}
              amountCentavos={props.paymentAmountCentavos}
            />
          );
        }
        if (tab === 'recording') {
          return <AdminBookingFathomSection booking={props.booking} />;
        }
        if (tab === 'quote') {
          return (
            <div className="rounded-2xl border border-border bg-card p-6 shadow-xs">
              <h2 className="text-lg font-semibold text-foreground">Custom checkout quote</h2>
              <div className="mt-4">
                <AdminBookingQuoteForm
                  bookingId={props.booking.id}
                  status={props.booking.status}
                  initialQuotedAmountCentavos={props.booking.quotedAmountCentavos}
                  initialQuoteExpiresAtIso={props.booking.quoteExpiresAtIso}
                  catalogAmountLabel={props.catalogAmountLabel}
                />
              </div>
            </div>
          );
        }
        return (
          <div className="rounded-2xl border border-border bg-card p-6 shadow-xs">
            <h2 className="text-lg font-semibold text-foreground">Guided diagnostic</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Full question blocks and option lists as saved from the session at booking time.
            </p>
            <div className="mt-6">
              <BookingDiagnosticReadonly guidedDiagnosticRaw={props.booking.guidedDiagnosticSnapshot} />
            </div>
          </div>
        );
      }}
    />
  );
}
