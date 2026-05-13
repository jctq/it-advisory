import { parse } from 'date-fns';
import { fromZonedTime } from 'date-fns-tz';
import { PRIMARY_TIMEZONE } from '@/lib/timezone';

/**
 * Parses marketing booking slot strings (date + 12h label) into an absolute UTC instant in `PRIMARY_TIMEZONE`.
 */
export function parseBookingSlotToUtc(dateYYYYMMDD: string, time12HourLabel: string): Date {
  const trimmedDate = dateYYYYMMDD.trim();
  const trimmedTime = time12HourLabel.trim();
  const wallClock = parse(`${trimmedDate} ${trimmedTime}`, 'yyyy-MM-dd h:mm a', new Date(0));
  if (Number.isNaN(wallClock.getTime())) {
    throw new TypeError('Invalid booking date or time.');
  }
  return fromZonedTime(wallClock, PRIMARY_TIMEZONE);
}
