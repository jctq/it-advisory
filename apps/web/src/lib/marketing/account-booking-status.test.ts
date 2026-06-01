import { describe, expect, it } from 'vitest';
import {
  buildAccountDiagnosticsBookingStatusMatch,
  resolveAccountBookingStatus,
  resolveAdminBookingLifecycleStatus,
} from './account-booking-status';

describe('resolveAccountBookingStatus', () => {
  it('returns awaiting_payment when checkout is open', () => {
    expect(
      resolveAccountBookingStatus({
        bookingStatus: 'pending',
        paymentTransactionStatus: 'pending',
        isDiagnosticComplete: true,
        isBooked: true,
      }),
    ).toBe('awaiting_payment');
  });

  it('returns confirmed when paid', () => {
    expect(
      resolveAccountBookingStatus({
        bookingStatus: 'pending',
        paymentTransactionStatus: 'paid',
        isDiagnosticComplete: true,
        isBooked: true,
      }),
    ).toBe('confirmed');
  });

  it('returns pending when unpaid and no open checkout', () => {
    expect(
      resolveAccountBookingStatus({
        bookingStatus: null,
        paymentTransactionStatus: null,
        isDiagnosticComplete: false,
        isBooked: false,
      }),
    ).toBe('pending');
  });

  it('returns refund_awaiting from booking status', () => {
    expect(
      resolveAccountBookingStatus({
        bookingStatus: 'refund_awaiting',
        paymentTransactionStatus: 'paid',
        isDiagnosticComplete: true,
        isBooked: true,
      }),
    ).toBe('refund_awaiting');
  });

  it('returns refunded from booking status', () => {
    expect(
      resolveAccountBookingStatus({
        bookingStatus: 'refunded',
        paymentTransactionStatus: 'refunded',
        isDiagnosticComplete: true,
        isBooked: true,
      }),
    ).toBe('refunded');
  });
});

describe('resolveAdminBookingLifecycleStatus', () => {
  it('returns awaiting_payment when a transaction is linked but unpaid', () => {
    expect(
      resolveAdminBookingLifecycleStatus({
        status: 'pending',
        paymentStatus: 'pending',
        paymentTransactionId: '507f1f77bcf86cd799439013',
      }),
    ).toBe('awaiting_payment');
  });
});

describe('buildAccountDiagnosticsBookingStatusMatch', () => {
  it('filters completed on booking status', () => {
    expect(buildAccountDiagnosticsBookingStatusMatch('completed')).toEqual({
      'linkedBooking.status': 'completed',
    });
  });

  it('filters refund_awaiting on booking status', () => {
    expect(buildAccountDiagnosticsBookingStatusMatch('refund_awaiting')).toEqual({
      'linkedBooking.status': 'refund_awaiting',
    });
  });
});
