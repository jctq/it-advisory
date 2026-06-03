import { addDays, parse } from 'date-fns';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import { ObjectId } from 'mongodb';
import { COLLECTIONS } from '@/domain/collections';
import type { AdvisorBookingSettingsDocument } from '@/domain/types';
import {
  buildActiveOpenPaymentHoldFilter,
  hasGlobalOpenPaymentHoldAtSlot,
  listOpenPaymentHoldStartsUtcInRange,
  listPaidOccupiedStartsUtcInRange,
} from '@/lib/data/payment-transactions';
import { RELEASED_BOOKING_SLOT_STARTS_AT } from '@/lib/booking/released-booking-slot';
import { getDb } from '@/lib/mongodb';

const ADVISOR_SETTINGS_ID = 'default' as const;
const ADVISOR_SETTINGS_CHECKOUT_CACHE_TTL_MS = 60_000 as const;
let advisorBookingSettingsCheckoutCache: {
  readonly doc: AdvisorBookingSettingsDocument | null;
  readonly cachedAtMs: number;
} | null = null;

export function invalidateAdvisorBookingSettingsCheckoutCache(): void {
  advisorBookingSettingsCheckoutCache = null;
}

/** Bookings that still reserve a calendar slot (excludes pending rows after checkout hold expired). */
function buildActiveBookingSlotOccupancyFilter(): Record<string, unknown> {
  return {
    startsAt: { $ne: RELEASED_BOOKING_SLOT_STARTS_AT },
    $or: [
      { status: 'confirmed' },
      {
        status: 'pending',
        paymentStatus: { $ne: 'expired' },
        $or: [
          { paymentStatus: { $in: ['paid', 'pending', 'processing'] } },
          { paymentStatus: { $exists: false } },
          { paymentStatus: null },
        ],
      },
    ],
  };
}

export function addCalendarDaysToYmd(ymd: string, days: number, timeZone: string): string {
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
  const nowMs = Date.now();
  if (
    advisorBookingSettingsCheckoutCache !== null &&
    nowMs - advisorBookingSettingsCheckoutCache.cachedAtMs < ADVISOR_SETTINGS_CHECKOUT_CACHE_TTL_MS
  ) {
    return advisorBookingSettingsCheckoutCache.doc;
  }
  const db = await getDb();
  const doc = await db.collection<AdvisorBookingSettingsDocument>(COLLECTIONS.advisorBookingSettings).findOne({
    _id: ADVISOR_SETTINGS_ID,
  });
  const resolved = doc ?? null;
  advisorBookingSettingsCheckoutCache = { doc: resolved, cachedAtMs: nowMs };
  return resolved;
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
  invalidateAdvisorBookingSettingsCheckoutCache();
  const next = await findAdvisorBookingSettingsDocument();
  if (next === null) {
    throw new Error('Failed to read advisor booking settings after save.');
  }
  return next;
}

function buildExcludeDiagnosticSessionBookingFilter(excludeSessionObjectId: ObjectId): Record<string, unknown> {
  return {
    $or: [
      { diagnosticSessionId: { $exists: false } },
      { diagnosticSessionId: null },
      { diagnosticSessionId: { $ne: excludeSessionObjectId } },
    ],
  };
}

function buildExcludeOwnCheckoutReservationFilter(input: {
  readonly excludeSessionObjectId: ObjectId;
  readonly excludeVisitorId: string;
}): Record<string, unknown> {
  const visitorId = input.excludeVisitorId.trim();
  if (visitorId.length === 0) {
    return buildExcludeDiagnosticSessionBookingFilter(input.excludeSessionObjectId);
  }
  return {
    $nor: [
      { diagnosticSessionId: input.excludeSessionObjectId },
      {
        visitorId,
        status: 'pending',
      },
    ],
  };
}

/**
 * True when another visitor/session already occupies this instant (checkout fast path).
 */
export async function isCheckoutSlotInstantOccupiedExcludingSession(input: {
  readonly startsAtUtc: Date;
  readonly excludeDiagnosticSessionIdHex: string;
  readonly excludeVisitorId?: string | null;
}): Promise<boolean> {
  if (!process.env.MONGODB_URI) {
    return false;
  }
  const excludeSessionHex = input.excludeDiagnosticSessionIdHex.trim();
  const excludeVisitorId = input.excludeVisitorId?.trim() ?? '';
  if (excludeSessionHex.length === 0) {
    return hasGlobalActiveBookingAtSlot({ startsAtUtc: input.startsAtUtc });
  }
  let excludeSessionObjectId: ObjectId;
  try {
    excludeSessionObjectId = new ObjectId(excludeSessionHex);
  } catch {
    return hasGlobalActiveBookingAtSlot({ startsAtUtc: input.startsAtUtc });
  }
  const db = await getDb();
  const now = new Date();
  const holdFilter = buildActiveOpenPaymentHoldFilter(now);
  const holdAndClauses: Record<string, unknown>[] = Array.isArray(holdFilter.$and)
    ? [...(holdFilter.$and as Record<string, unknown>[])]
    : [];
  const holdExclusion: Record<string, unknown> =
    excludeVisitorId.length > 0
      ? {
          $nor: [
            { diagnosticSessionIdHex: excludeSessionHex },
            { visitorId: excludeVisitorId, status: { $in: ['pending', 'processing'] } },
          ],
        }
      : {
          $or: [
            { diagnosticSessionIdHex: { $exists: false } },
            { diagnosticSessionIdHex: null },
            { diagnosticSessionIdHex: { $ne: excludeSessionHex } },
          ],
        };
  holdAndClauses.push(holdExclusion);
  const bookingExclusion = buildExcludeOwnCheckoutReservationFilter({
    excludeSessionObjectId,
    excludeVisitorId,
  });
  const [bookingCount, holdCount, paidCount] = await Promise.all([
    db.collection(COLLECTIONS.bookings).countDocuments({
      ...buildActiveBookingSlotOccupancyFilter(),
      startsAt: input.startsAtUtc,
      ...bookingExclusion,
    }),
    db.collection(COLLECTIONS.paymentTransactions).countDocuments({
      startsAt: input.startsAtUtc,
      status: holdFilter.status,
      ...(holdAndClauses.length > 0 ? { $and: holdAndClauses } : {}),
    }),
    db.collection(COLLECTIONS.paymentTransactions).countDocuments({
      status: 'paid',
      startsAt: input.startsAtUtc,
    }),
  ]);
  if (bookingCount > 0 || holdCount > 0) {
    return true;
  }
  if (paidCount === 0) {
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
          ...buildActiveBookingSlotOccupancyFilter(),
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
 * Like {@link listActiveBookingStartsUtcInYmdWindow} but omits reservations owned by the given diagnostic session
 * so the same diagnostic can retry checkout on its held slot without appearing globally taken.
 */
export async function listActiveBookingStartsUtcInYmdWindowForCheckout(input: {
  readonly serviceKey: string;
  readonly fromYmd: string;
  readonly toYmd: string;
  readonly bufferDays: number;
  readonly timeZone: string;
  readonly excludeDiagnosticSessionIdHex: string;
}): Promise<Date[]> {
  if (!process.env.MONGODB_URI) {
    return [];
  }
  const excludeSessionHex = input.excludeDiagnosticSessionIdHex.trim();
  if (excludeSessionHex.length === 0) {
    return listActiveBookingStartsUtcInYmdWindow(input);
  }
  let excludeSessionObjectId: ObjectId;
  try {
    excludeSessionObjectId = new ObjectId(excludeSessionHex);
  } catch {
    return listActiveBookingStartsUtcInYmdWindow(input);
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
          ...buildActiveBookingSlotOccupancyFilter(),
          startsAt: { $gte: rangeStart, $lt: rangeEndExclusive },
          $or: [
            { diagnosticSessionId: { $exists: false } },
            { diagnosticSessionId: null },
            { diagnosticSessionId: { $ne: excludeSessionObjectId } },
          ],
        },
        { projection: { startsAt: 1 } },
      )
      .sort({ startsAt: 1 })
      .toArray(),
    listOpenPaymentHoldStartsUtcInRange({
      rangeStartUtc: rangeStart,
      rangeEndExclusiveUtc: rangeEndExclusive,
      excludeDiagnosticSessionIdHex: excludeSessionHex,
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
