import { describe, expect, it } from 'vitest';
import { isOverdueUnpaidPendingBooking } from './overdue-pending-booking';

describe('isOverdueUnpaidPendingBooking', () => {
  it('returns true for pending unpaid booking in the past', () => {
    expect(
      isOverdueUnpaidPendingBooking({
        status: 'pending',
        startsAt: new Date('2020-01-01T00:00:00.000Z'),
        paymentStatus: null,
      }),
    ).toBe(true);
  });

  it('returns false for future pending booking', () => {
    expect(
      isOverdueUnpaidPendingBooking({
        status: 'pending',
        startsAt: new Date('2099-01-01T00:00:00.000Z'),
        paymentStatus: null,
      }),
    ).toBe(false);
  });

  it('returns false when already paid', () => {
    expect(
      isOverdueUnpaidPendingBooking({
        status: 'pending',
        startsAt: new Date('2020-01-01T00:00:00.000Z'),
        paymentStatus: 'paid',
      }),
    ).toBe(false);
  });
});
