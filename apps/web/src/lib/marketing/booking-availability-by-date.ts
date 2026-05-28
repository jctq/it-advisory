import { sortBookingSlotTimesForManilaDate } from '@/lib/marketing/sort-booking-slot-times-for-manila-date';

export type PublicAvailabilitySlotRow = {
  readonly date: string;
  readonly time: string;
};

/**
 * Groups public availability API rows into a Manila date → time labels map.
 */
export function buildAvailabilityByDateFromSlots(
  slots: readonly PublicAvailabilitySlotRow[],
): Record<string, readonly string[]> {
  const map: Record<string, string[]> = {};
  for (const row of slots) {
    const existing = map[row.date];
    if (existing === undefined) {
      map[row.date] = [row.time];
    } else {
      existing.push(row.time);
    }
  }
  for (const key of Object.keys(map)) {
    const list = map[key];
    if (list !== undefined) {
      sortBookingSlotTimesForManilaDate(key, list);
    }
  }
  return map;
}
