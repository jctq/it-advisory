'use client';

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
import { AdminBookingOverviewPanel } from '@/components/admin/admin-booking-overview-panel';
import { AdminBookingPaymentSection } from '@/components/admin/admin-booking-payment-section';
import { AdminBookingQuoteForm } from '@/components/admin/admin-booking-quote-form';
import { AdminBookingStatusForm } from '@/components/admin/admin-booking-status-form';
import { AdminDetailTabsShell, type AdminDetailTabConfig } from '@/components/admin/admin-detail-tabs-shell';
import { resolveBookingDetailTab, type BookingDetailCalendarBundle, type BookingDetailTab } from '@/lib/admin/admin-detail-tab-routing';
import type { AdminBookingOverviewContext } from '@/lib/admin/admin-booking-overview-types';
import type { BookingDetailRow } from '@/lib/data/bookings';
import type { BookingPaymentBreakdown } from '@/lib/payments/booking-payment-breakdown-types';

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
  readonly paymentBreakdown: BookingPaymentBreakdown | null;
  readonly catalogAmountLabel: string;
  readonly calendarBundle: BookingDetailCalendarBundle | null;
  readonly overview: AdminBookingOverviewContext;
};

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
          return (
            <AdminBookingOverviewPanel
              booking={props.booking}
              overview={props.overview}
              meetingUrl={props.meetingUrl}
              recordingShareUrl={props.recordingShareUrl}
              calendarBundle={props.calendarBundle}
              paymentStatus={props.booking.paymentStatus}
            />
          );
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
              paymentBreakdown={props.paymentBreakdown}
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
