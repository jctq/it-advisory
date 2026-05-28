import type { BookingDocument } from '@/domain/types';

export type OverduePendingBookingInput = {
  readonly status: BookingDocument['status'];
  readonly startsAt: Date;
  readonly paymentStatus: BookingDocument['paymentStatus'] | null | undefined;
};

/**
 * Pending booking whose session start is in the past and has not been paid online.
 */
export function isOverdueUnpaidPendingBooking(input: OverduePendingBookingInput): boolean {
  if (input.status !== 'pending') {
    return false;
  }
  if (input.paymentStatus === 'paid') {
    return false;
  }
  return input.startsAt.getTime() < Date.now();
}
