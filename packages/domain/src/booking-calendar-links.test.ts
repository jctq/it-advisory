import { describe, expect, it } from 'vitest';
import { buildBookingCalendarLinkBundle } from './booking-calendar-links.js';

describe('buildBookingCalendarLinkBundle', () => {
  it('includes Google template action and UTC window', () => {
    const startsAtUtc = new Date('2026-05-16T02:30:00.000Z');
    const bundle = buildBookingCalendarLinkBundle({
      title: 'Project Rescue',
      description: 'Ref ABC',
      location: 'https://example.test/meet',
      startsAtUtc,
      durationMinutes: 90,
      icsUidSeed: 'abc123',
    });
    expect(bundle.googleCalendarUrl).toContain('calendar.google.com/calendar/render');
    expect(bundle.googleCalendarUrl).toContain('action=TEMPLATE');
    expect(bundle.googleCalendarUrl).toContain('20260516T023000Z');
    expect(bundle.googleCalendarUrl).toContain('20260516T040000Z');
    expect(bundle.outlookCalendarUrl).toContain('outlook.office.com');
    expect(bundle.icsDataUrl.startsWith('data:text/calendar')).toBe(true);
    expect(decodeURIComponent(bundle.icsDataUrl.replace(/^data:text\/calendar;charset=utf-8,/, ''))).toContain(
      'BEGIN:VCALENDAR',
    );
  });
});
