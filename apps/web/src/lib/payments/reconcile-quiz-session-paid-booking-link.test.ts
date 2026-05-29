import { describe, expect, it, vi } from 'vitest';
import { reconcileQuizSessionPaidBookingLink } from './reconcile-quiz-session-paid-booking-link';

vi.mock('@/lib/data/bookings', () => ({
  findPrimaryBookingSlotByQuizSessionId: vi.fn(),
  linkQuizSessionToVisitorBooking: vi.fn(),
}));

vi.mock('@/lib/data/payment-transactions', () => ({
  findLatestPaymentTransactionByQuizSessionIdHex: vi.fn(),
}));

vi.mock('@/lib/payments/payment-completion', () => ({
  ensurePaidTransactionFulfilled: vi.fn(),
}));

describe('reconcileQuizSessionPaidBookingLink', () => {
  it('returns false when a booking is already linked to the session', async () => {
    const { findPrimaryBookingSlotByQuizSessionId } = await import('@/lib/data/bookings');
    vi.mocked(findPrimaryBookingSlotByQuizSessionId).mockResolvedValue({
      bookingId: '507f1f77bcf86cd799439012',
      status: 'confirmed',
      startsAtIso: '2026-05-29T12:00:00.000Z',
      timezone: 'Asia/Manila',
      serviceKey: 'project-rescue',
      meetingUrl: null,
      paymentTransactionId: null,
      paymentMethodLabel: null,
      paymentStatus: 'paid',
      customerName: null,
      customerEmail: null,
      customerCompany: null,
      customerPhone: null,
      paymentExpiresAtIso: null,
    });
    const actual = await reconcileQuizSessionPaidBookingLink({
      quizSessionIdHex: '507f1f77bcf86cd799439011',
      visitorId: 'acct:user',
    });
    expect(actual).toBe(false);
  });
});
