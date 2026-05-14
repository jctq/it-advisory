import { parseBookingSlotToUtc } from '@/lib/marketing/booking-slot';

/**
 * Sorts 12-hour slot labels for a single Manila calendar day by actual wall-clock order.
 */
export function sortBookingSlotTimesForManilaDate(manilaYmd: string, times: string[]): void {
  times.sort((a, b) => {
    const ta = parseBookingSlotToUtc(manilaYmd, a).getTime();
    const tb = parseBookingSlotToUtc(manilaYmd, b).getTime();
    return ta - tb;
  });
}
