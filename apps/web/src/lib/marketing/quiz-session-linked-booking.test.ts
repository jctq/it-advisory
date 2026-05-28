import { describe, expect, it } from 'vitest';
import {
  isLinkedBookingCheckoutResumable,
  isPendingCheckoutResumable,
  type LinkedBookingSlotSnapshot,
  type PendingCheckoutSnapshot,
} from './quiz-session-linked-booking';

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

  it('returns false when the latest payment is expired', () => {
    expect(
      isLinkedBookingCheckoutResumable(linkedPending, {
        latestPaymentStatus: 'expired',
        serverNowMs: Date.parse('2026-06-01T02:30:00.000Z'),
      }),
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
