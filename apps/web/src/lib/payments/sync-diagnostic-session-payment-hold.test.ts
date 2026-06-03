import { ObjectId } from 'mongodb';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RELEASED_BOOKING_SLOT_STARTS_AT } from '@/lib/booking/released-booking-slot';

vi.mock('@/lib/data/bookings', () => ({
  findBookingById: vi.fn(),
  findPrimaryBookingSlotByDiagnosticSessionId: vi.fn(),
}));

vi.mock('@/lib/data/payment-settings', () => ({
  getPaymentSettings: vi.fn(async () => ({ holdExpiresMinutes: 15 })),
}));

vi.mock('@/lib/data/payment-transactions', () => ({
  findLatestPaymentTransactionByDiagnosticSessionIdHex: vi.fn(),
}));

vi.mock('@/lib/payments/cancel-expired-payment-window-bookings', () => ({
  cancelExpiredPaymentWindowBookings: vi.fn(async () => 0),
}));

vi.mock('@/lib/payments/payment-completion', () => ({
  applyPaymentStatusToBooking: vi.fn(),
  renewBookingCheckoutHoldFromOpenTransaction: vi.fn(),
  resetBookingAfterExpiredPaymentHold: vi.fn(),
}));

describe('syncDiagnosticSessionPaymentHold', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('releases an occupied slot when the checkout transaction is already expired', async () => {
    const bookingId = new ObjectId().toString();
    const sessionHex = new ObjectId().toString();
    const slotStartsAt = new Date('2099-06-01T01:00:00.000Z');
    const { findPrimaryBookingSlotByDiagnosticSessionId, findBookingById } = await import('@/lib/data/bookings');
    const { findLatestPaymentTransactionByDiagnosticSessionIdHex } = await import('@/lib/data/payment-transactions');
    const { resetBookingAfterExpiredPaymentHold } = await import('@/lib/payments/payment-completion');
    vi.mocked(findPrimaryBookingSlotByDiagnosticSessionId).mockResolvedValue({
      bookingId,
      status: 'pending',
      startsAtIso: slotStartsAt.toISOString(),
      timezone: 'Asia/Manila',
      serviceKey: 'project-rescue',
      meetingUrl: null,
      paymentTransactionId: null,
      paymentMethodLabel: null,
      paymentStatus: null,
      customerName: null,
      customerEmail: null,
      customerCompany: null,
      customerPhone: null,
      paymentExpiresAtIso: null,
      recordingOptIn: false,
    });
    vi.mocked(findBookingById).mockResolvedValue({
      id: bookingId,
      status: 'pending',
      startsAtIso: slotStartsAt.toISOString(),
      paymentStatus: null,
      paymentExpiresAtIso: null,
    } as Awaited<ReturnType<typeof findBookingById>>);
    vi.mocked(findLatestPaymentTransactionByDiagnosticSessionIdHex).mockResolvedValue({
      id: new ObjectId().toString(),
      status: 'expired',
      expiresAtIso: '2020-01-01T00:00:00.000Z',
      createdAtIso: '2020-01-01T00:00:00.000Z',
      bookingId,
    } as Awaited<ReturnType<typeof findLatestPaymentTransactionByDiagnosticSessionIdHex>>);
    const { syncDiagnosticSessionPaymentHold } = await import('@/lib/payments/sync-diagnostic-session-payment-hold');
    const result = await syncDiagnosticSessionPaymentHold({
      diagnosticSessionIdHex: sessionHex,
      visitorId: 'visitor-1',
      now: new Date('2025-01-01T00:00:00.000Z'),
    });
    expect(result.expired).toBe(true);
    expect(resetBookingAfterExpiredPaymentHold).toHaveBeenCalledWith(new ObjectId(bookingId));
  });

  it('does not release a slot while the payment hold is still active', async () => {
    const bookingId = new ObjectId().toString();
    const sessionHex = new ObjectId().toString();
    const slotStartsAt = new Date('2099-06-01T01:00:00.000Z');
    const { findPrimaryBookingSlotByDiagnosticSessionId, findBookingById } = await import('@/lib/data/bookings');
    const { findLatestPaymentTransactionByDiagnosticSessionIdHex } = await import('@/lib/data/payment-transactions');
    const { resetBookingAfterExpiredPaymentHold } = await import('@/lib/payments/payment-completion');
    vi.mocked(findPrimaryBookingSlotByDiagnosticSessionId).mockResolvedValue({
      bookingId,
      status: 'pending',
      startsAtIso: slotStartsAt.toISOString(),
      timezone: 'Asia/Manila',
      serviceKey: 'project-rescue',
      meetingUrl: null,
      paymentTransactionId: null,
      paymentMethodLabel: null,
      paymentStatus: null,
      customerName: null,
      customerEmail: null,
      customerCompany: null,
      customerPhone: null,
      paymentExpiresAtIso: '2099-01-01T00:00:00.000Z',
      recordingOptIn: false,
    });
    vi.mocked(findBookingById).mockResolvedValue({
      id: bookingId,
      status: 'pending',
      startsAtIso: slotStartsAt.toISOString(),
      paymentStatus: null,
      paymentExpiresAtIso: '2099-01-01T00:00:00.000Z',
    } as Awaited<ReturnType<typeof findBookingById>>);
    vi.mocked(findLatestPaymentTransactionByDiagnosticSessionIdHex).mockResolvedValue(null);
    const { syncDiagnosticSessionPaymentHold } = await import('@/lib/payments/sync-diagnostic-session-payment-hold');
    const result = await syncDiagnosticSessionPaymentHold({
      diagnosticSessionIdHex: sessionHex,
      visitorId: 'visitor-1',
      now: new Date('2025-01-01T00:00:00.000Z'),
    });
    expect(result.expired).toBe(false);
    expect(resetBookingAfterExpiredPaymentHold).not.toHaveBeenCalled();
  });

  it('skips release when the slot was already cleared', async () => {
    const bookingId = new ObjectId().toString();
    const sessionHex = new ObjectId().toString();
    const { findPrimaryBookingSlotByDiagnosticSessionId, findBookingById } = await import('@/lib/data/bookings');
    const { resetBookingAfterExpiredPaymentHold } = await import('@/lib/payments/payment-completion');
    vi.mocked(findPrimaryBookingSlotByDiagnosticSessionId).mockResolvedValue({
      bookingId,
      status: 'pending',
      startsAtIso: RELEASED_BOOKING_SLOT_STARTS_AT.toISOString(),
      timezone: 'Asia/Manila',
      serviceKey: 'project-rescue',
      meetingUrl: null,
      paymentTransactionId: null,
      paymentMethodLabel: null,
      paymentStatus: 'expired',
      customerName: null,
      customerEmail: null,
      customerCompany: null,
      customerPhone: null,
      paymentExpiresAtIso: null,
      recordingOptIn: false,
    });
    vi.mocked(findBookingById).mockResolvedValue({
      id: bookingId,
      status: 'pending',
      startsAtIso: RELEASED_BOOKING_SLOT_STARTS_AT.toISOString(),
      paymentStatus: 'expired',
      paymentExpiresAtIso: null,
    } as Awaited<ReturnType<typeof findBookingById>>);
    const { syncDiagnosticSessionPaymentHold } = await import('@/lib/payments/sync-diagnostic-session-payment-hold');
    const result = await syncDiagnosticSessionPaymentHold({
      diagnosticSessionIdHex: sessionHex,
      visitorId: 'visitor-1',
      now: new Date('2025-01-01T00:00:00.000Z'),
    });
    expect(result.expired).toBe(true);
    expect(resetBookingAfterExpiredPaymentHold).not.toHaveBeenCalled();
  });
});
