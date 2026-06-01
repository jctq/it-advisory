import { describe, expect, it, vi } from 'vitest';
import { reconcileDiagnosticSessionPaidBookingLink } from './reconcile-diagnostic-session-paid-booking-link';

vi.mock('@/lib/data/bookings', () => ({
  findPrimaryBookingSlotByDiagnosticSessionId: vi.fn(),
  linkDiagnosticSessionToVisitorBooking: vi.fn(),
}));

vi.mock('@/lib/data/payment-transactions', () => ({
  findLatestPaymentTransactionByDiagnosticSessionIdHex: vi.fn(),
}));

vi.mock('@/lib/payments/payment-completion', () => ({
  ensurePaidTransactionFulfilled: vi.fn(),
}));

describe('reconcileDiagnosticSessionPaidBookingLink', () => {
  it('returns false when a booking is already linked to the session', async () => {
    const { findPrimaryBookingSlotByDiagnosticSessionId } = await import('@/lib/data/bookings');
    vi.mocked(findPrimaryBookingSlotByDiagnosticSessionId).mockResolvedValue({
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
    const actual = await reconcileDiagnosticSessionPaidBookingLink({
      diagnosticSessionIdHex: '507f1f77bcf86cd799439011',
      visitorId: 'acct:user',
    });
    expect(actual).toBe(false);
  });
});
