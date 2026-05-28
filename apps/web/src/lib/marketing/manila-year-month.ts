import { addMonths, parse } from 'date-fns';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import { PRIMARY_TIMEZONE } from '@/lib/timezone';

/**
 * Adds calendar months to a Manila `yyyy-MM` string.
 */
export function addManilaYearMonth(manilaYearMonth: string, deltaMonths: number): string {
  const pivot = fromZonedTime(
    parse(`${manilaYearMonth}-15 12:00`, 'yyyy-MM-dd HH:mm', new Date(0)),
    PRIMARY_TIMEZONE,
  );
  return formatInTimeZone(addMonths(pivot, deltaMonths), PRIMARY_TIMEZONE, 'yyyy-MM');
}
