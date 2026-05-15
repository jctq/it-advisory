import { formatInTimeZone } from 'date-fns-tz';
import { PRIMARY_TIMEZONE } from '@/lib/timezone';

export type BookingSlotParts = {
  readonly date: string;
  readonly time: string;
};

/** Formats a stored booking `startsAt` into marketing checkout date/time strings. */
export function formatBookingSlotPartsFromStartsAt(startsAt: Date, timezone: string = PRIMARY_TIMEZONE): BookingSlotParts {
  return {
    date: formatInTimeZone(startsAt, timezone, 'yyyy-MM-dd'),
    time: formatInTimeZone(startsAt, timezone, 'h:mm a'),
  };
}
