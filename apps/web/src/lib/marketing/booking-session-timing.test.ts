import { describe, expect, it } from 'vitest';
import {
  isBookingSessionEndedByFathom,
  resolveBookingSessionDisplayPhase,
  resolveBookingSessionTiming,
} from './booking-session-timing';

describe('isBookingSessionEndedByFathom', () => {
  it('returns true when booking status is completed', () => {
    expect(
      isBookingSessionEndedByFathom({
        sessionEndedAtIso: null,
        bookingStatus: 'completed',
      }),
    ).toBe(true);
  });

  it('returns true when sessionEndedAtIso is set', () => {
    expect(
      isBookingSessionEndedByFathom({
        sessionEndedAtIso: '2026-05-30T01:00:00.000Z',
        bookingStatus: 'confirmed',
      }),
    ).toBe(true);
  });
});

describe('resolveBookingSessionDisplayPhase', () => {
  it('prefers fathom ended over live timing window', () => {
    const serverNowMs = Date.parse('2026-05-30T01:30:00.000Z');
    const timing = resolveBookingSessionTiming({
      startsAtIso: '2026-05-30T01:00:00.000Z',
      serverNowMs,
    });
    expect(timing?.phase).toBe('live');
    expect(
      resolveBookingSessionDisplayPhase({
        timing,
        sessionEndedAtIso: '2026-05-30T02:00:00.000Z',
        bookingStatus: 'completed',
      }),
    ).toBe('ended');
  });
});
