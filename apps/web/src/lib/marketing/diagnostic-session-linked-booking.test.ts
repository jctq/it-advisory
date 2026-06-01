import { describe, expect, it } from 'vitest';
import {
  isLinkedBookingCheckoutResumable,
  isLinkedBookingDeferredCheckoutEligible,
  isLinkedBookingNeedsSlotRebook,
  isPendingCheckoutResumable,
  resolveCanDeleteDiagnosticSession,
  type LinkedBookingSlotSnapshot,
  type PendingCheckoutSnapshot,
} from './diagnostic-session-linked-booking';

const linkedPending: LinkedBookingSlotSnapshot = {
  bookingId: '507f1f77bcf86cd799439011',
  status: 'pending',
  startsAtIso: '2026-06-01T02:00:00.000Z',
  timezone: 'Asia/Manila',
  serviceKey: 'project-rescue',
  meetingUrl: null,
  paymentTransactionId: '507f1f77bcf86cd799439012',
  paymentMethodLabel: null,
  paymentStatus: 'pending',
  customerName: 'Test User',
  customerEmail: 'test@example.com',
  customerCompany: null,
  customerPhone: '+639171234567',
  paymentExpiresAtIso: '2026-06-01T03:00:00.000Z',
  recordingOptIn: false,
};

const pendingCheckout: PendingCheckoutSnapshot = {
  transactionId: '507f1f77bcf86cd799439013',
  startsAtIso: '2026-06-01T02:00:00.000Z',
  timezone: 'Asia/Manila',
  serviceKey: 'project-rescue',
  customerName: 'Test User',
  customerEmail: 'test@example.com',
  customerCompany: null,
  customerPhone: '+639171234567',
  expiresAtIso: '2026-06-01T03:00:00.000Z',
  bookingId: null,
};

describe('isLinkedBookingCheckoutResumable', () => {
  it('returns false when the payment hold window has closed', () => {
    expect(
      isLinkedBookingCheckoutResumable(linkedPending, {
        latestPaymentStatus: 'pending',
        serverNowMs: Date.parse('2026-06-01T04:00:00.000Z'),
      }),
    ).toBe(false);
  });

  it('returns true when the latest payment is expired but the booking hold was refreshed', () => {
    expect(
      isLinkedBookingCheckoutResumable(linkedPending, {
        latestPaymentStatus: 'expired',
        serverNowMs: Date.parse('2026-06-01T02:30:00.000Z'),
      }),
    ).toBe(true);
  });

  it('returns false when the latest payment is expired and the booking hold is closed', () => {
    expect(
      isLinkedBookingCheckoutResumable(
        { ...linkedPending, paymentExpiresAtIso: '2026-05-01T03:00:00.000Z' },
        {
          latestPaymentStatus: 'expired',
          serverNowMs: Date.parse('2026-06-01T02:30:00.000Z'),
        },
      ),
    ).toBe(false);
  });

  it('returns true while the hold is still open', () => {
    expect(
      isLinkedBookingCheckoutResumable(linkedPending, {
        latestPaymentStatus: 'processing',
        serverNowMs: Date.parse('2026-06-01T02:30:00.000Z'),
      }),
    ).toBe(true);
  });

  it('returns true when the latest payment is open but the linked booking row is still expired', () => {
    expect(
      isLinkedBookingCheckoutResumable(
        { ...linkedPending, paymentStatus: 'expired', paymentExpiresAtIso: null },
        {
          latestPaymentStatus: 'pending',
          paymentHoldExpiresAtIso: '2026-06-01T03:00:00.000Z',
          serverNowMs: Date.parse('2026-06-01T02:30:00.000Z'),
        },
      ),
    ).toBe(true);
  });

  it('returns false when the latest payment is already paid', () => {
    expect(
      isLinkedBookingCheckoutResumable(linkedPending, {
        latestPaymentStatus: 'paid',
        serverNowMs: Date.parse('2026-06-01T02:30:00.000Z'),
      }),
    ).toBe(false);
  });
});

describe('isLinkedBookingNeedsSlotRebook', () => {
  it('returns true for released slot placeholder', () => {
    expect(
      isLinkedBookingNeedsSlotRebook({
        ...linkedPending,
        startsAtIso: '1970-01-01T00:00:00.000Z',
        paymentExpiresAtIso: null,
        paymentStatus: null,
      }),
    ).toBe(true);
  });

  it('returns false after reschedule with cleared hold fields', () => {
    expect(
      isLinkedBookingNeedsSlotRebook(
        {
          ...linkedPending,
          paymentExpiresAtIso: null,
          paymentStatus: null,
          paymentTransactionId: null,
        },
        { serverNowMs: Date.parse('2026-06-01T02:30:00.000Z') },
      ),
    ).toBe(false);
  });
});

describe('isLinkedBookingDeferredCheckoutEligible', () => {
  it('returns true for future pending booking without an active hold', () => {
    expect(
      isLinkedBookingDeferredCheckoutEligible(
        {
          ...linkedPending,
          paymentExpiresAtIso: null,
          paymentStatus: null,
          paymentTransactionId: null,
        },
        { serverNowMs: Date.parse('2026-05-01T00:00:00.000Z') },
      ),
    ).toBe(true);
  });

  it('returns false when checkout is not resumable and slot still needs rebook', () => {
    expect(
      isLinkedBookingDeferredCheckoutEligible({
        ...linkedPending,
        startsAtIso: '1970-01-01T00:00:00.000Z',
        paymentExpiresAtIso: null,
        paymentStatus: 'expired',
      }),
    ).toBe(false);
  });
});

describe('isPendingCheckoutResumable', () => {
  it('returns false when checkout payment has expired', () => {
    expect(
      isPendingCheckoutResumable(pendingCheckout, {
        latestPaymentStatus: 'expired',
        paymentHoldExpiresAtIso: pendingCheckout.expiresAtIso,
        serverNowMs: Date.parse('2026-06-01T02:30:00.000Z'),
      }),
    ).toBe(false);
  });
});

describe('resolveCanDeleteDiagnosticSession', () => {
  it('allows delete for in-progress diagnostics without a booking', () => {
    expect(
      resolveCanDeleteDiagnosticSession({
        hasDiagnosticContent: true,
        bookingStatus: null,
        paymentTransactionStatus: null,
        isDiagnosticComplete: false,
        isBooked: false,
      }),
    ).toBe(true);
  });

  it('allows delete when the linked booking is pending and checkout is not open', () => {
    expect(
      resolveCanDeleteDiagnosticSession({
        hasDiagnosticContent: true,
        bookingStatus: 'pending',
        paymentTransactionStatus: 'expired',
        isDiagnosticComplete: true,
        isBooked: true,
      }),
    ).toBe(true);
  });

  it('hides delete when the linked booking is confirmed', () => {
    expect(
      resolveCanDeleteDiagnosticSession({
        hasDiagnosticContent: true,
        bookingStatus: 'confirmed',
        paymentTransactionStatus: 'paid',
        isDiagnosticComplete: true,
        isBooked: true,
      }),
    ).toBe(false);
  });

  it('hides delete while checkout payment is open', () => {
    expect(
      resolveCanDeleteDiagnosticSession({
        hasDiagnosticContent: true,
        bookingStatus: 'pending',
        paymentTransactionStatus: 'pending',
        isDiagnosticComplete: true,
        isBooked: true,
      }),
    ).toBe(false);
  });

  it('hides delete for completed bookings', () => {
    expect(
      resolveCanDeleteDiagnosticSession({
        hasDiagnosticContent: true,
        bookingStatus: 'completed',
        paymentTransactionStatus: 'paid',
        isDiagnosticComplete: true,
        isBooked: true,
      }),
    ).toBe(false);
  });
});
