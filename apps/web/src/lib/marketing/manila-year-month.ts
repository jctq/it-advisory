import { addMonths, parse } from 'date-fns';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import { PRIMARY_TIMEZONE } from '@/lib/timezone';

export type ManilaYearMonthParts = {
  readonly year: number;
  readonly month: number;
};

/**
 * Parses a Manila `yyyy-MM` string into year and month parts.
 */
export function parseManilaYearMonth(manilaYearMonth: string): ManilaYearMonthParts {
  const [yearRaw, monthRaw] = manilaYearMonth.split('-');
  return { year: Number(yearRaw), month: Number(monthRaw) };
}

/**
 * Builds a Manila `yyyy-MM` string from year and month parts.
 */
export function buildManilaYearMonth(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

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

/**
 * Formats a Manila month number (1–12) for display.
 */
export function formatManilaMonthLabel(month: number, pattern: 'MMMM' | 'MMM' = 'MMMM'): string {
  return formatInTimeZone(
    fromZonedTime(
      parse(`2000-${String(month).padStart(2, '0')}-15 12:00`, 'yyyy-MM-dd HH:mm', new Date(0)),
      PRIMARY_TIMEZONE,
    ),
    PRIMARY_TIMEZONE,
    pattern,
  );
}

/**
 * Resolves selectable years for a booking month picker.
 */
export function resolveManilaYearOptions(visibleManilaYearMonth: string): readonly number[] {
  const currentYear = Number(formatInTimeZone(new Date(), PRIMARY_TIMEZONE, 'yyyy'));
  const visibleYear = parseManilaYearMonth(visibleManilaYearMonth).year;
  const minYear = Math.min(currentYear - 1, visibleYear);
  const maxYear = Math.max(currentYear + 5, visibleYear);
  return Array.from({ length: maxYear - minYear + 1 }, (_, index) => minYear + index);
}
