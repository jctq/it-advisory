import { addDays, parse } from 'date-fns';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import { PRIMARY_TIMEZONE } from '@/lib/timezone';

const MANILA_YMD_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isManilaYmd(value: string): boolean {
  return MANILA_YMD_PATTERN.test(value);
}

/** Current calendar date in {@link PRIMARY_TIMEZONE}. */
export function resolveManilaTodayYmd(): string {
  return formatInTimeZone(new Date(), PRIMARY_TIMEZONE, 'yyyy-MM-dd');
}

export function addManilaYmdDays(ymd: string, days: number): string {
  const anchor = fromZonedTime(parse(`${ymd} 12:00`, 'yyyy-MM-dd HH:mm', new Date(0)), PRIMARY_TIMEZONE);
  return formatInTimeZone(addDays(anchor, days), PRIMARY_TIMEZONE, 'yyyy-MM-dd');
}

/**
 * Inclusive Manila date range as UTC instants: `[startsAtFrom, startsAtToExclusive)`.
 */
export function resolveManilaInclusiveYmdRangeBounds(fromYmd: string, toYmd: string): {
  readonly startsAtFrom: Date;
  readonly startsAtToExclusive: Date;
} {
  const startsAtFrom = fromZonedTime(
    parse(`${fromYmd} 00:00:00`, 'yyyy-MM-dd HH:mm:ss', new Date(0)),
    PRIMARY_TIMEZONE,
  );
  const startsAtToExclusive = fromZonedTime(
    parse(`${addManilaYmdDays(toYmd, 1)} 00:00:00`, 'yyyy-MM-dd HH:mm:ss', new Date(0)),
    PRIMARY_TIMEZONE,
  );
  return { startsAtFrom, startsAtToExclusive };
}

/**
 * Maps a FullCalendar visible range to inclusive Manila YMD bounds (`end` is exclusive in FC).
 */
export function resolveManilaYmdRangeFromCalendarVisibleRange(
  start: Date,
  end: Date,
): { readonly fromYmd: string; readonly toYmd: string } {
  const fromYmd = formatInTimeZone(start, PRIMARY_TIMEZONE, 'yyyy-MM-dd');
  const lastVisibleInstant = new Date(end.getTime() - 1);
  const toYmd = formatInTimeZone(lastVisibleInstant, PRIMARY_TIMEZONE, 'yyyy-MM-dd');
  return { fromYmd, toYmd };
}
