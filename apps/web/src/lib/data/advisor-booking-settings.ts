import { addDays, parse } from 'date-fns';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import { COLLECTIONS } from '@/domain/collections';
import type { AdvisorBookingSettingsDocument } from '@/domain/types';
import {
  hasGlobalOpenPaymentHoldAtSlot,
  listOpenPaymentHoldStartsUtcInRange,
  listPaidOccupiedStartsUtcInRange,
} from '@/lib/data/payment-transactions';
import { getDb } from '@/lib/mongodb';

const ADVISOR_SETTINGS_ID = 'default' as const;

function addCalendarDaysToYmd(ymd: string, days: number, timeZone: string): string {
  const base = fromZonedTime(parse(`${ymd} 12:00`, 'yyyy-MM-dd HH:mm', new Date(0)), timeZone);
  return formatInTimeZone(addDays(base, days), timeZone, 'yyyy-MM-dd');
}

function ymdStartUtc(ymd: string, timeZone: string): Date {
  return fromZonedTime(parse(`${ymd} 00:00`, 'yyyy-MM-dd HH:mm', new Date(0)), timeZone);
}

function ymdEndExclusiveUtc(nextDayYmd: string, timeZone: string): Date {
  return fromZonedTime(parse(`${nextDayYmd} 00:00`, 'yyyy-MM-dd HH:mm', new Date(0)), timeZone);
}

/**
 * Loads the singleton advisor booking settings row, or null when none exists (legacy marketing fallback).
 */
export async function findAdvisorBookingSettingsDocument(): Promise<AdvisorBookingSettingsDocument | null> {
  if (!process.env.MONGODB_URI) {
    return null;
  }
  const db = await getDb();
  const doc = await db.collection<AdvisorBookingSettingsDocument>(COLLECTIONS.advisorBookingSettings).findOne({
    _id: ADVISOR_SETTINGS_ID,
  });
  return doc ?? null;
}

/**
 * Replaces the singleton advisor booking settings document.
 */
export async function replaceAdvisorBookingSettingsDocument(
  doc: AdvisorBookingSettingsDocument,
): Promise<AdvisorBookingSettingsDocument> {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is not configured.');
  }
  const db = await getDb();
  await db.collection<AdvisorBookingSettingsDocument>(COLLECTIONS.advisorBookingSettings).replaceOne(
    { _id: ADVISOR_SETTINGS_ID },
    { ...doc, _id: ADVISOR_SETTINGS_ID } as AdvisorBookingSettingsDocument,
    { upsert: true },
  );
  const next = await findAdvisorBookingSettingsDocument();
  if (next === null) {
    throw new Error('Failed to read advisor booking settings after save.');
  }
  return next;
}

function mergeUniqueSortedStartsUtc(...groups: readonly (readonly Date[])[]): Date[] {
  const seen = new Set<number>();
  const merged: Date[] = [];
  for (const group of groups) {
    for (const instant of group) {
      const key = instant.getTime();
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      merged.push(instant);
    }
  }
  merged.sort((a, b) => a.getTime() - b.getTime());
  return merged;
}

/**
 * Lists occupied slot instants for the shared advisor calendar (all services): pending/confirmed bookings,
 * active checkout holds, and paid checkouts without a released booking.
 *
 * {@link input.serviceKey} is retained for API compatibility but does not scope occupancy — one advisor
 * cannot double-book the same instant across catalog services.
 */
export async function listActiveBookingStartsUtcInYmdWindow(input: {
  readonly serviceKey: string;
  readonly fromYmd: string;
  readonly toYmd: string;
  readonly bufferDays: number;
  readonly timeZone: string;
}): Promise<Date[]> {
  if (!process.env.MONGODB_URI) {
    return [];
  }
  const loadFrom = addCalendarDaysToYmd(input.fromYmd, -input.bufferDays, input.timeZone);
  const loadTo = addCalendarDaysToYmd(input.toYmd, input.bufferDays, input.timeZone);
  const rangeStart = ymdStartUtc(loadFrom, input.timeZone);
  const rangeEndExclusive = ymdEndExclusiveUtc(addCalendarDaysToYmd(loadTo, 1, input.timeZone), input.timeZone);
  const db = await getDb();
  const [bookingRows, holdStarts, paidStarts] = await Promise.all([
    db
      .collection<{ startsAt: Date }>(COLLECTIONS.bookings)
      .find(
        {
          status: { $in: ['pending', 'confirmed'] },
          startsAt: { $gte: rangeStart, $lt: rangeEndExclusive },
        },
        { projection: { startsAt: 1 } },
      )
      .sort({ startsAt: 1 })
      .toArray(),
    listOpenPaymentHoldStartsUtcInRange({
      rangeStartUtc: rangeStart,
      rangeEndExclusiveUtc: rangeEndExclusive,
    }),
    listPaidOccupiedStartsUtcInRange({
      rangeStartUtc: rangeStart,
      rangeEndExclusiveUtc: rangeEndExclusive,
    }),
  ]);
  return mergeUniqueSortedStartsUtc(
    bookingRows.map((row) => row.startsAt),
    holdStarts,
    paidStarts,
  );
}

/**
 * Returns true when any non-cancelled booking, active checkout hold, or paid checkout occupies this instant.
 */
export async function hasGlobalActiveBookingAtSlot(input: {
  readonly startsAtUtc: Date;
}): Promise<boolean> {
  if (!process.env.MONGODB_URI) {
    return false;
  }
  const db = await getDb();
  const [bookingCount, holdTaken, paidOccupied] = await Promise.all([
    db.collection(COLLECTIONS.bookings).countDocuments({
      status: { $in: ['pending', 'confirmed'] },
      startsAt: input.startsAtUtc,
    }),
    hasGlobalOpenPaymentHoldAtSlot({
      startsAtUtc: input.startsAtUtc,
    }),
    db.collection(COLLECTIONS.paymentTransactions).countDocuments({
      status: 'paid',
      startsAt: input.startsAtUtc,
    }),
  ]);
  if (bookingCount > 0 || holdTaken) {
    return true;
  }
  if (paidOccupied === 0) {
    return false;
  }
  const paidRow = await db.collection(COLLECTIONS.paymentTransactions).findOne(
    { status: 'paid', startsAt: input.startsAtUtc },
    { projection: { bookingId: 1 } },
  );
  if (paidRow === null) {
    return false;
  }
  if (paidRow.bookingId === undefined || paidRow.bookingId === null) {
    return true;
  }
  const linkedBooking = await db.collection(COLLECTIONS.bookings).findOne(
    { _id: paidRow.bookingId },
    { projection: { status: 1 } },
  );
  return linkedBooking === null || linkedBooking.status !== 'cancelled';
}
