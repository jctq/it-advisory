import { addDays, parse } from 'date-fns';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';

import { PRIMARY_TIMEZONE } from '@/lib/timezone';

/**
 * Returns inclusive `yyyy-MM-dd` bounds in `PRIMARY_TIMEZONE` for the 6-row month grid (Sun–Sat weeks)
 * that contains the given `yyyy-MM` calendar month in that zone.
 */
export function resolveManilaMonthGridYmdBounds(visibleManilaYearMonth: string): { readonly from: string; readonly to: string } {
  const [yRaw, mRaw] = visibleManilaYearMonth.split('-');
  const y = Number(yRaw);
  const m = Number(mRaw);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const firstYmd = `${yRaw}-${mRaw}-01`;
  const lastYmd = `${yRaw}-${mRaw}-${String(lastDay).padStart(2, '0')}`;
  const tz = PRIMARY_TIMEZONE;
  const manilaNoon = (ymd: string): Date =>
    fromZonedTime(parse(`${ymd} 12:00`, 'yyyy-MM-dd HH:mm', new Date(0)), tz);
  const addManilaDays = (ymd: string, delta: number): string =>
    formatInTimeZone(addDays(manilaNoon(ymd), delta), tz, 'yyyy-MM-dd');
  const isoDay = (ymd: string): number => Number(formatInTimeZone(manilaNoon(ymd), tz, 'i'));
  const sundayOnOrBefore = (ymd: string): string => {
    const iso = isoDay(ymd);
    const daysBack = iso === 7 ? 0 : iso;
    return addManilaDays(ymd, -daysBack);
  };
  const gridFrom = sundayOnOrBefore(firstYmd);
  const sunForLast = sundayOnOrBefore(lastYmd);
  const gridTo = addManilaDays(sunForLast, 6);
  return { from: gridFrom, to: gridTo };
}

/**
 * Returns every `yyyy-MM-dd` in `PRIMARY_TIMEZONE` for the given `yyyy-MM` calendar month.
 */
export function resolveManilaMonthDayYmds(visibleManilaYearMonth: string): readonly string[] {
  const [yRaw, mRaw] = visibleManilaYearMonth.split('-');
  const y = Number(yRaw);
  const m = Number(mRaw);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const ymds: string[] = [];
  for (let day = 1; day <= lastDay; day += 1) {
    ymds.push(`${yRaw}-${mRaw}-${String(day).padStart(2, '0')}`);
  }
  return ymds;
}
