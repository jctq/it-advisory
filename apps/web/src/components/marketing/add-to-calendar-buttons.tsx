'use client';

import Link from 'next/link';
import type { ReactElement } from 'react';
import {
  BOOKING_SESSION_CALENDAR_DURATION_MINUTES,
  buildBookingCalendarLinkBundle,
} from '@techmd/domain/booking-calendar-links';
import { cn } from '@/lib/utils';

export type AddToCalendarButtonsProps = {
  readonly startsAtIso: string;
  readonly title: string;
  readonly description: string;
  readonly location?: string;
  readonly icsUidSeed: string;
  readonly className?: string;
};

/**
 * Google, Outlook, and Apple (.ics) shortcuts for a single scheduled block.
 */
export function AddToCalendarButtons(props: AddToCalendarButtonsProps): ReactElement {
  const startsAtUtc = new Date(props.startsAtIso);
  const location = props.location?.trim() ?? '';
  const bundle = buildBookingCalendarLinkBundle({
    title: props.title,
    description: props.description,
    location,
    startsAtUtc,
    durationMinutes: BOOKING_SESSION_CALENDAR_DURATION_MINUTES,
    icsUidSeed: props.icsUidSeed,
  });
  return (
    <div className={cn('flex flex-wrap items-center gap-2', props.className)}>
      <span className="text-xs font-medium text-muted-foreground">Add to calendar</span>
      <Link
        href={bundle.googleCalendarUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium text-primary underline-offset-4 hover:underline"
      >
        Google
      </Link>
      <Link
        href={bundle.outlookCalendarUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium text-primary underline-offset-4 hover:underline"
      >
        Outlook
      </Link>
      <a
        href={bundle.icsDataUrl}
        download="booking.ics"
        className="rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium text-primary underline-offset-4 hover:underline"
      >
        Apple (.ics)
      </a>
    </div>
  );
}
