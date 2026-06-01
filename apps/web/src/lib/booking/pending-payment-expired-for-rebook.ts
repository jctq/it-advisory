import type { BookingDocument } from '@/domain/types';
import { RELEASED_BOOKING_SLOT_STARTS_AT } from '@/lib/booking/released-booking-slot';

export function isReleasedBookingSlotStartsAt(startsAt: Date): boolean {
  return startsAt.getTime() === RELEASED_BOOKING_SLOT_STARTS_AT.getTime();
}

/**
 * Pending booking whose checkout hold expired and must pick a new slot before paying again.
 */
export function isPendingPaymentExpiredForRebook(input: {
  readonly status: BookingDocument['status'];
  readonly paymentStatus: BookingDocument['paymentStatus'] | null | undefined;
  readonly paymentExpiresAt: Date | null | undefined;
  readonly startsAt: Date;
  readonly nowMs?: number;
}): boolean {
  if (input.status !== 'pending') {
    return false;
  }
  if (input.paymentStatus === 'paid') {
    return false;
  }
  if (input.paymentStatus === 'expired') {
    return true;
  }
  if (isReleasedBookingSlotStartsAt(input.startsAt)) {
    return true;
  }
  const nowMs = input.nowMs ?? Date.now();
  const paymentExpiresAt = input.paymentExpiresAt;
  if (paymentExpiresAt !== null && paymentExpiresAt !== undefined && paymentExpiresAt.getTime() <= nowMs) {
    return true;
  }
  return false;
}
