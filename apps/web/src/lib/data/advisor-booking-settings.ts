import { addDays, parse } from 'date-fns';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import { COLLECTIONS } from '@/domain/collections';
import type { AdvisorBookingSettingsDocument } from '@/domain/types';
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

/**
 * Lists `startsAt` for non-cancelled bookings in a calendar window (with buffer days) for caps and taken slots.
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
  const cursor = db
    .collection<{ startsAt: Date }>(COLLECTIONS.bookings)
    .find(
      {
        serviceKey: input.serviceKey,
        status: { $in: ['pending', 'confirmed'] },
        startsAt: { $gte: rangeStart, $lt: rangeEndExclusive },
      },
      { projection: { startsAt: 1 } },
    )
    .sort({ startsAt: 1 });
  const rows = await cursor.toArray();
  return rows.map((r) => r.startsAt);
}

/**
 * Returns true when any non-cancelled booking already uses this instant for the service (solo advisor).
 */
export async function hasGlobalActiveBookingAtSlot(input: {
  readonly serviceKey: string;
  readonly startsAtUtc: Date;
}): Promise<boolean> {
  if (!process.env.MONGODB_URI) {
    return false;
  }
  const db = await getDb();
  const count = await db.collection(COLLECTIONS.bookings).countDocuments({
    serviceKey: input.serviceKey,
    status: { $in: ['pending', 'confirmed'] },
    startsAt: input.startsAtUtc,
  });
  return count > 0;
}
