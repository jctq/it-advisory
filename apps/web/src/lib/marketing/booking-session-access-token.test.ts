import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import {
  canIssueBookingSessionAccessToken,
  issueBookingSessionAccessToken,
  verifyBookingSessionAccessToken,
} from './booking-session-access-token';

const SAMPLE_BOOKING_ID = '507f1f77bcf86cd799439011';
const SAMPLE_STARTS_AT_ISO = '2030-06-15T02:00:00.000Z';

describe('booking-session-access-token', () => {
  const previousSecret = process.env.BOOKING_SESSION_ACCESS_SECRET;

  beforeEach(() => {
    process.env.BOOKING_SESSION_ACCESS_SECRET = 'test-booking-session-access-secret';
  });

  afterEach(() => {
    if (previousSecret === undefined) {
      delete process.env.BOOKING_SESSION_ACCESS_SECRET;
    } else {
      process.env.BOOKING_SESSION_ACCESS_SECRET = previousSecret;
    }
  });

  it('issues and verifies a token for a booking', () => {
    expect(canIssueBookingSessionAccessToken()).toBe(true);
    const token = issueBookingSessionAccessToken({
      bookingId: SAMPLE_BOOKING_ID,
      startsAtIso: SAMPLE_STARTS_AT_ISO,
    });
    expect(typeof token).toBe('string');
    expect(token!.length).toBeGreaterThan(20);
    const verified = verifyBookingSessionAccessToken(token!);
    expect(verified).toEqual({ bookingId: SAMPLE_BOOKING_ID });
  });

  it('rejects tampered tokens', () => {
    const token = issueBookingSessionAccessToken({
      bookingId: SAMPLE_BOOKING_ID,
      startsAtIso: SAMPLE_STARTS_AT_ISO,
    });
    expect(token).not.toBeNull();
    const tampered = `${token!.slice(0, -4)}xxxx`;
    expect(verifyBookingSessionAccessToken(tampered)).toBeNull();
  });

  it('returns null when secret is missing', () => {
    delete process.env.BOOKING_SESSION_ACCESS_SECRET;
    delete process.env.QUIZ_SESSION_URL_SECRET;
    expect(canIssueBookingSessionAccessToken()).toBe(false);
    expect(
      issueBookingSessionAccessToken({
        bookingId: SAMPLE_BOOKING_ID,
        startsAtIso: SAMPLE_STARTS_AT_ISO,
      }),
    ).toBeNull();
  });
});
