import { describe, expect, it } from 'vitest';
import {
  addManilaYmdDays,
  isManilaYmd,
  resolveManilaInclusiveYmdRangeBounds,
  resolveManilaYmdRangeFromCalendarVisibleRange,
} from './admin-bookings-calendar-range';

describe('admin-bookings-calendar-range', () => {
  it('validates Manila YMD strings', () => {
    expect(isManilaYmd('2026-05-27')).toBe(true);
    expect(isManilaYmd('2026-5-27')).toBe(false);
  });

  it('adds days in Manila calendar', () => {
    expect(addManilaYmdDays('2026-05-27', 1)).toBe('2026-05-28');
  });

  it('builds exclusive end for inclusive date range', () => {
    const { startsAtFrom, startsAtToExclusive } = resolveManilaInclusiveYmdRangeBounds(
      '2026-05-27',
      '2026-05-27',
    );
    expect(startsAtToExclusive.getTime() - startsAtFrom.getTime()).toBe(24 * 60 * 60 * 1000);
  });

  it('maps FullCalendar visible range to inclusive YMDs', () => {
    const start = new Date('2026-05-26T16:00:00.000Z');
    const end = new Date('2026-06-02T16:00:00.000Z');
    const actual = resolveManilaYmdRangeFromCalendarVisibleRange(start, end);
    expect(actual.fromYmd).toBe('2026-05-27');
    expect(actual.toYmd).toBe('2026-06-02');
  });
});
