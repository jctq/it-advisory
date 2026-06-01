import { describe, expect, it } from 'vitest';
import { RELEASED_BOOKING_SLOT_STARTS_AT } from './released-booking-slot';
import { isPendingPaymentExpiredForRebook } from './pending-payment-expired-for-rebook';

describe('isPendingPaymentExpiredForRebook', () => {
  it('returns true when payment status is expired', () => {
    expect(
      isPendingPaymentExpiredForRebook({
        status: 'pending',
        paymentStatus: 'expired',
        paymentExpiresAt: null,
        startsAt: new Date('2099-01-01T00:00:00.000Z'),
      }),
    ).toBe(true);
  });

  it('returns true when slot was released after hold expiry', () => {
    expect(
      isPendingPaymentExpiredForRebook({
        status: 'pending',
        paymentStatus: null,
        paymentExpiresAt: null,
        startsAt: RELEASED_BOOKING_SLOT_STARTS_AT,
      }),
    ).toBe(true);
  });

  it('returns true when payment expiresAt is in the past', () => {
    expect(
      isPendingPaymentExpiredForRebook({
        status: 'pending',
        paymentStatus: null,
        paymentExpiresAt: new Date('2020-01-01T00:00:00.000Z'),
        startsAt: new Date('2099-01-01T00:00:00.000Z'),
        nowMs: Date.parse('2025-01-01T00:00:00.000Z'),
      }),
    ).toBe(true);
  });

  it('returns false for future pending booking with active hold', () => {
    expect(
      isPendingPaymentExpiredForRebook({
        status: 'pending',
        paymentStatus: null,
        paymentExpiresAt: new Date('2099-01-01T00:00:00.000Z'),
        startsAt: new Date('2099-06-01T00:00:00.000Z'),
        nowMs: Date.parse('2025-01-01T00:00:00.000Z'),
      }),
    ).toBe(false);
  });
});
