'use client';

import Link from 'next/link';
import { formatInTimeZone } from 'date-fns-tz';
import {
  CalendarPlus,
  CheckCircle2,
  CircleAlert,
  Copy,
  ExternalLink,
  FileText,
  Stethoscope,
  Video,
} from 'lucide-react';
import { useState, type ReactElement } from 'react';
import type { PaymentStatus } from '@/domain/payment-types';
import type { BookingDocument } from '@/domain/types';
import { AdminBookingStatusForm } from '@/components/admin/admin-booking-status-form';
import { AdminFathomNotesLink } from '@/components/admin/admin-fathom-notes-link';
import { MarkBookingPaidButton } from '@/components/admin/mark-booking-paid-button';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CopyToClipboardButton } from '@/components/ui/copy-to-clipboard-button';
import type { AdminBookingOverviewContext } from '@/lib/admin/admin-booking-overview-types';
import type { BookingDetailCalendarBundle } from '@/lib/admin/admin-detail-tab-routing';
import type { BookingDetailRow } from '@/lib/data/bookings';
import { notifyError, notifySuccess } from '@/lib/notify';
import { cn } from '@/lib/utils';

type AdminBookingOverviewPanelProps = {
  readonly booking: BookingDetailRow;
  readonly overview: AdminBookingOverviewContext;
  readonly meetingUrl: string;
  readonly recordingShareUrl: string;
  readonly calendarBundle: BookingDetailCalendarBundle | null;
  readonly paymentStatus: PaymentStatus | null;
};

type OverviewFieldProps = {
  readonly label: string;
  readonly children: ReactElement | string;
  readonly className?: string;
};

function OverviewField(props: OverviewFieldProps): ReactElement {
  return (
    <div className={cn('space-y-1', props.className)}>
      <p className="text-xs font-medium text-muted-foreground">{props.label}</p>
      <div className="text-sm text-foreground">{props.children}</div>
    </div>
  );
}

function CopyableIdRow(props: { readonly label: string; readonly value: string }): ReactElement {
  const [hasCopied, setHasCopied] = useState(false);
  const executeCopy = (): void => {
    void navigator.clipboard.writeText(props.value).then(() => {
      setHasCopied(true);
      notifySuccess(`${props.label} copied.`);
      window.setTimeout(() => setHasCopied(false), 2000);
    }).catch(() => {
      notifyError(`Could not copy ${props.label.toLowerCase()}.`);
    });
  };
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-border/70 bg-background/60 px-3 py-2">
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted-foreground">{props.label}</p>
        <p className="mt-0.5 truncate font-mono text-xs text-foreground" title={props.value}>
          {props.value}
        </p>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-9 shrink-0"
        aria-label={hasCopied ? `${props.label} copied` : `Copy ${props.label}`}
        onClick={executeCopy}
      >
        <Copy className="size-4" aria-hidden />
      </Button>
    </div>
  );
}

function resolveStatusBadgeVariant(
  status: BookingDocument['status'],
): 'default' | 'secondary' | 'outline' | 'destructive' {
  if (status === 'confirmed') {
    return 'default';
  }
  if (status === 'completed') {
    return 'secondary';
  }
  if (status === 'cancelled' || status === 'refunded') {
    return 'destructive';
  }
  return 'outline';
}

function formatStatusLabel(status: BookingDocument['status']): string {
  if (status === 'refund_awaiting') {
    return 'Refund awaiting';
  }
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function formatPaymentStatusLabel(status: PaymentStatus | null): string | null {
  if (status === null) {
    return null;
  }
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function AdminBookingOverviewPanel(props: AdminBookingOverviewPanelProps): ReactElement {
  const { booking, overview, meetingUrl, recordingShareUrl, calendarBundle } = props;
  const startsAt = new Date(booking.startsAtIso);
  const startsAtLabel = formatInTimeZone(startsAt, booking.timezone, 'EEEE, MMM d, yyyy');
  const startsAtTimeLabel = formatInTimeZone(startsAt, booking.timezone, 'h:mm a');
  const paymentStatusLabel = formatPaymentStatusLabel(props.paymentStatus);
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-card p-6 shadow-xs">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 space-y-2">
            <p className="text-xs font-medium text-muted-foreground">
              Reference{' '}
              <span className="inline-flex items-center gap-1">
                <span className="font-mono text-foreground">{overview.bookingReference}</span>
                <CopyToClipboardButton value={overview.bookingReference} ariaLabel="Copy booking reference" />
              </span>
            </p>
            <h2 className="text-xl font-semibold tracking-tight text-foreground">{overview.serviceTitle}</h2>
            {overview.sessionTitlePreview !== null ? (
              <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">{overview.sessionTitlePreview}</p>
            ) : null}
            <p className="text-sm text-foreground">
              <span className="font-medium">{startsAtLabel}</span>
              <span className="text-muted-foreground"> · </span>
              <span className="tabular-nums font-medium">{startsAtTimeLabel}</span>
              <span className="text-muted-foreground"> ({booking.timezone})</span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={resolveStatusBadgeVariant(booking.status)} className="capitalize">
              {formatStatusLabel(booking.status)}
            </Badge>
            {paymentStatusLabel !== null ? (
              <Badge variant="outline">{paymentStatusLabel} payment</Badge>
            ) : null}
          </div>
        </div>
      </div>
      <div className="rounded-2xl border border-border bg-card p-6 shadow-xs">
        <h3 className="text-sm font-semibold text-foreground">Session</h3>
        <p className="mt-1 text-sm text-muted-foreground">Join the call, add the slot to your calendar, or open related records.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {meetingUrl.length > 0 ? (
            <Button asChild size="sm" className="gap-2">
              <a href={meetingUrl} target="_blank" rel="noopener noreferrer">
                <Video className="size-4" aria-hidden />
                Join meeting
                <ExternalLink className="size-3.5 opacity-70" aria-hidden />
              </a>
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">Meeting link not generated yet.</p>
          )}
          {booking.diagnosticSessionId !== null ? (
            <Button asChild variant="outline" size="sm" className="gap-2">
              <Link href={`/admin/sessions/${booking.diagnosticSessionId}`}>
                <Stethoscope className="size-4" aria-hidden />
                Diagnostic session
              </Link>
            </Button>
          ) : null}
        </div>
        {calendarBundle !== null ? (
          <div className="mt-4 rounded-xl border border-border/70 bg-muted/15 px-4 py-3">
            <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <CalendarPlus className="size-3.5 shrink-0" aria-hidden />
              Add to calendar
            </p>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm">
              <a
                href={calendarBundle.googleCalendarUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                Google
              </a>
              <a
                href={calendarBundle.outlookCalendarUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                Outlook
              </a>
              <a
                href={calendarBundle.icsDataUrl}
                download={calendarBundle.icsDownloadName}
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                Apple (.ics)
              </a>
            </div>
          </div>
        ) : null}
        {recordingShareUrl.length > 0 || booking.recordingOptIn ? (
          <div className="mt-4 flex items-start gap-2 text-sm">
            <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
            <div>
              <p className="font-medium text-foreground">Meeting notes</p>
              <div className="mt-1">
                <AdminFathomNotesLink
                  fathomShareUrl={recordingShareUrl.length > 0 ? recordingShareUrl : null}
                  recordingOptIn={booking.recordingOptIn}
                />
              </div>
            </div>
          </div>
        ) : null}
      </div>
      <div className="rounded-2xl border border-border bg-card p-6 shadow-xs">
        <h3 className="text-sm font-semibold text-foreground">Client</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {overview.isGuestBooking
            ? 'Guest checkout — contact details from the booking lead.'
            : 'Signed-in account — profile email may differ from the lead on file.'}
        </p>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <OverviewField label="Name">{overview.contactName}</OverviewField>
          <OverviewField label="Email">
            {overview.contactEmail !== null ? (
              <a href={`mailto:${overview.contactEmail}`} className="font-medium text-primary underline-offset-4 hover:underline">
                {overview.contactEmail}
              </a>
            ) : (
              <span className="text-muted-foreground">Not provided</span>
            )}
          </OverviewField>
          {overview.contactCompany !== null ? (
            <OverviewField label="Company">{overview.contactCompany}</OverviewField>
          ) : null}
          {overview.contactPhone !== null ? (
            <OverviewField label="Phone">
              <a href={`tel:${overview.contactPhone}`} className="font-medium text-primary underline-offset-4 hover:underline">
                {overview.contactPhone}
              </a>
            </OverviewField>
          ) : null}
          {!overview.isGuestBooking && overview.accountEmail !== null ? (
            <OverviewField label="Account email" className="sm:col-span-2">
              {overview.accountEmail}
            </OverviewField>
          ) : null}
        </dl>
      </div>
      <div className="rounded-2xl border border-border bg-card p-6 shadow-xs">
        <h3 className="text-sm font-semibold text-foreground">Booking status</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Update lifecycle state for reporting and customer-facing manage pages.
        </p>
        <div className="mt-4">
          <AdminBookingStatusForm
            bookingId={booking.id}
            initialStatus={booking.status}
            paymentExpiresAtIso={booking.paymentExpiresAtIso}
          />
        </div>
      </div>
      <details className="group rounded-2xl border border-border bg-card shadow-xs">
        <summary className="cursor-pointer list-none px-6 py-4 text-sm font-semibold text-foreground marker:content-none [&::-webkit-details-marker]:hidden">
          <span className="flex items-center justify-between gap-2">
            Technical details
            <span className="text-xs font-normal text-muted-foreground group-open:hidden">Show IDs and system fields</span>
            <span className="hidden text-xs font-normal text-muted-foreground group-open:inline">Hide</span>
          </span>
        </summary>
        <div className="space-y-3 border-t border-border px-6 pb-6 pt-4">
          <CopyableIdRow label="Booking ID" value={booking.id} />
          <CopyableIdRow label="Lead ID" value={booking.leadId} />
          <CopyableIdRow label="Visitor ID" value={booking.visitorId} />
          <OverviewField label="Service key">
            <span className="font-mono text-xs">{booking.serviceKey}</span>
          </OverviewField>
          <OverviewField label="Diagnostic snapshot">
            {booking.hasDiagnosticSnapshot ? (
              <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="size-3.5 shrink-0" aria-hidden />
                Saved at booking time
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <CircleAlert className="size-3.5 shrink-0" aria-hidden />
                Not captured
              </span>
            )}
          </OverviewField>
        </div>
      </details>
      <div className="flex flex-wrap gap-3">
        <MarkBookingPaidButton bookingId={booking.id} status={booking.status} />
      </div>
    </div>
  );
}
