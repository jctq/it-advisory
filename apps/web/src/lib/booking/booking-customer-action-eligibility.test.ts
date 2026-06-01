import { describe, expect, it } from 'vitest';
import {
  isBookingPaidForCustomerAction,
  resolveBookingCustomerActionMode,
} from './booking-customer-action-eligibility';

describe('booking customer action eligibility', () => {
  it('allows cancel for manual confirm confirmed bookings without payment', () => {
    expect(
      resolveBookingCustomerActionMode({
        paymentPolicy: 'manual_confirm',
        bookingStatus: 'confirmed',
        isPaid: false,
      }),
    ).toBe('cancel');
  });

  it('allows refund for paid manual confirm confirmed bookings when refunds enabled', () => {
    expect(
      resolveBookingCustomerActionMode({
        paymentPolicy: 'manual_confirm',
        bookingStatus: 'confirmed',
        isPaid: true,
        refundsEnabled: true,
      }),
    ).toBe('refund');
  });

  it('allows refund for paid reserve-then-pay confirmed bookings when refunds enabled', () => {
    expect(
      resolveBookingCustomerActionMode({
        paymentPolicy: 'pay_after_hold',
        bookingStatus: 'confirmed',
        isPaid: true,
        refundsEnabled: true,
      }),
    ).toBe('refund');
  });

  it('does not allow refund for completed bookings', () => {
    expect(
      resolveBookingCustomerActionMode({
        paymentPolicy: 'pay_after_hold',
        bookingStatus: 'completed',
        isPaid: true,
        refundsEnabled: true,
      }),
    ).toBeNull();
  });

  it('hides refund when admin refunds setting is off', () => {
    expect(
      resolveBookingCustomerActionMode({
        paymentPolicy: 'pay_after_hold',
        bookingStatus: 'confirmed',
        isPaid: true,
        refundsEnabled: false,
      }),
    ).toBeNull();
  });

  it('treats legacy pay_before_booking like pay_after_hold', () => {
    expect(
      resolveBookingCustomerActionMode({
        paymentPolicy: 'pay_before_booking',
        bookingStatus: 'confirmed',
        isPaid: true,
        refundsEnabled: true,
      }),
    ).toBe('refund');
  });

  it('allows refund for paid pending bookings before confirmation when refunds enabled', () => {
    expect(
      resolveBookingCustomerActionMode({
        paymentPolicy: 'pay_after_hold',
        bookingStatus: 'pending',
        isPaid: true,
        refundsEnabled: true,
      }),
    ).toBe('refund');
  });

  it('detects paid bookings from payment transaction or booking payment status', () => {
    expect(
      isBookingPaidForCustomerAction({
        bookingPaymentStatus: null,
        paymentTransactionStatus: 'paid',
      }),
    ).toBe(true);
    expect(
      isBookingPaidForCustomerAction({
        bookingPaymentStatus: 'paid',
        paymentTransactionStatus: null,
      }),
    ).toBe(true);
  });
});
