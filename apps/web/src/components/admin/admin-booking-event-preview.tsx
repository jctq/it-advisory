'use client';

import Link from 'next/link';
import { type ReactElement } from 'react';
import { Badge } from '@/components/ui/badge';
import {
  PopoverArrow,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
} from '@/components/ui/popover';
import type { AdminBookingCalendarRow } from '@/lib/data/bookings';
import { formatBookingReferenceId } from '@/lib/marketing/booking-reference';
import { cn } from '@/lib/utils';

export type AdminBookingEventPreviewProps = {
  readonly booking: AdminBookingCalendarRow;
  readonly onPreviewPointerEnter?: () => void;
  readonly onPreviewPointerLeave?: () => void;
};

type PreviewFieldProps = {
  readonly label: string;
  readonly value: string;
  readonly mono?: boolean;
};

function PreviewField(props: PreviewFieldProps): ReactElement {
  return (
    <div className="grid grid-cols-[5.5rem_1fr] gap-x-2 gap-y-0.5 text-xs">
      <dt className="text-muted-foreground">{props.label}</dt>
      <dd className={cn('text-foreground', props.mono ? 'font-mono text-[0.6875rem]' : 'font-medium')}>
        {props.value}
      </dd>
    </div>
  );
}

function resolveStatusBadgeVariant(
  status: AdminBookingCalendarRow['status'],
): 'default' | 'secondary' | 'outline' {
  if (status === 'confirmed') {
    return 'default';
  }
  if (status === 'pending') {
    return 'secondary';
  }
  return 'outline';
}

function formatServiceKeyLabel(serviceKey: string): string {
  const parts = serviceKey.split(/[-_]/).filter((part) => part.length > 0);
  if (parts.length === 0) {
    return 'Consultation';
  }
  return parts
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}`)
    .join(' ');
}

/**
 * Popover body for an admin calendar booking hover preview.
 */
export function AdminBookingEventPreview(props: AdminBookingEventPreviewProps): ReactElement {
  const { booking } = props;
  const startsAtLabel = new Date(booking.startsAtIso).toLocaleString('en-PH', {
    timeZone: booking.timezone,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
  const bookingReference = formatBookingReferenceId(booking.id);
  return (
    <PopoverContent
      className="w-80 p-0"
      side="top"
      align="start"
      sideOffset={8}
      onOpenAutoFocus={(event) => event.preventDefault()}
      onPointerEnter={props.onPreviewPointerEnter}
      onPointerLeave={props.onPreviewPointerLeave}
    >
      <PopoverArrow className="fill-popover" width={12} height={6} />
      <PopoverHeader className="gap-2 border-b border-border px-4 py-3">
        <div className="flex items-start justify-between gap-2">
          <PopoverTitle className="text-sm leading-snug">
            {formatServiceKeyLabel(booking.serviceKey)}
          </PopoverTitle>
          <Badge variant={resolveStatusBadgeVariant(booking.status)} className="shrink-0 capitalize">
            {booking.status}
          </Badge>
        </div>
        <PopoverDescription className="text-xs">{startsAtLabel}</PopoverDescription>
      </PopoverHeader>
      <dl className="space-y-2 px-4 py-3">
        <PreviewField label="Name" value={booking.contactName} />
        {booking.contactEmail !== null ? (
          <PreviewField label="Email" value={booking.contactEmail} />
        ) : null}
        {booking.contactCompany !== null ? (
          <PreviewField label="Company" value={booking.contactCompany} />
        ) : null}
        {booking.contactPhone !== null ? (
          <PreviewField label="Phone" value={booking.contactPhone} />
        ) : null}
      </dl>
      {booking.isGuestBooking ? (
        <div className="space-y-2 border-t border-border bg-muted/30 px-4 py-3">
          <p className="text-xs font-semibold text-foreground">Guest booking</p>
          <dl className="space-y-2">
            <PreviewField label="Reference" value={bookingReference} mono />
            <PreviewField label="Visitor" value={booking.visitorId} mono />
            {booking.contactEmail === null ? (
              <p className="text-xs text-muted-foreground">No email on file for this lead.</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Guest manage lookup uses this email and the phone last four digits.
              </p>
            )}
            {booking.quizSessionId !== null ? (
              <div className="text-xs">
                <span className="text-muted-foreground">Session </span>
                <Link
                  href={`/admin/sessions/${booking.quizSessionId}`}
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  View diagnostic session
                </Link>
              </div>
            ) : null}
            {booking.hasDiagnosticSnapshot ? (
              <p className="text-xs text-muted-foreground">Diagnostic snapshot saved at booking time.</p>
            ) : null}
          </dl>
        </div>
      ) : (
        <div className="space-y-2 border-t border-border px-4 py-3">
          <p className="text-xs font-semibold text-foreground">Signed-in account</p>
          {booking.accountEmail !== null ? (
            <PreviewField label="Account" value={booking.accountEmail} />
          ) : (
            <p className="text-xs text-muted-foreground">Visitor id matches a marketing account.</p>
          )}
          {booking.quizSessionId !== null ? (
            <div className="text-xs">
              <span className="text-muted-foreground">Session </span>
              <Link
                href={`/admin/sessions/${booking.quizSessionId}`}
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                View diagnostic session
              </Link>
            </div>
          ) : null}
        </div>
      )}
      <p className="border-t border-border px-4 py-2 text-[0.6875rem] text-muted-foreground">
        Click the event to open full booking details.
      </p>
    </PopoverContent>
  );
}
