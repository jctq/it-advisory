import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  createDefaultAdvisorBookingSettingsDocument,
  materializeAdvisorBookingSettingsDocument,
} from '@techmd/domain/booking-schedule';
import type { AdvisorBookingSettingsDocument, AdvisorWeekdayOverride } from '@/domain/types';
import {
  findAdvisorBookingSettingsDocument,
  replaceAdvisorBookingSettingsDocument,
} from '@/lib/data/advisor-booking-settings';
import { PRIMARY_TIMEZONE } from '@/lib/timezone';

export const dynamic = 'force-dynamic';

const hm = z.string().regex(/^\d{1,2}:\d{2}$/);

function parseHmToMinutesForValidation(hmValue: string): number | null {
  const trimmed = hmValue.trim();
  const match = /^(\d{1,2}):(\d{2})$/.exec(trimmed);
  if (match === null) {
    return null;
  }
  const hours = Number.parseInt(match[1]!, 10);
  const minutes = Number.parseInt(match[2]!, 10);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }
  return hours * 60 + minutes;
}

function isAdvisorWindowStartBeforeEnd(window: { readonly start: string; readonly end: string }): boolean {
  const startMin = parseHmToMinutesForValidation(window.start);
  const endMin = parseHmToMinutesForValidation(window.end);
  return startMin !== null && endMin !== null && startMin < endMin;
}

const advisorDayWindowSchema = z
  .object({ start: hm, end: hm })
  .refine(isAdvisorWindowStartBeforeEnd, { message: 'Start must be before end (HH:mm).' });

const weekdayClosedOverrideSchema = z.object({ kind: z.literal('closed') });
const weekdayWindowOverrideSchema = z.object({
  kind: z.literal('window'),
  start: hm,
  end: hm,
});

const weekdayOverrideSchema: z.ZodType<AdvisorWeekdayOverride> = z
  .union([weekdayClosedOverrideSchema, weekdayWindowOverrideSchema])
  .superRefine((value, context) => {
    if (value.kind !== 'window') {
      return;
    }
    if (isAdvisorWindowStartBeforeEnd(value)) {
      return;
    }
    context.addIssue({
      code: 'custom',
      message: 'Start must be before end (HH:mm).',
      path: ['start'],
    });
  });

const patchSchema = z.object({
  timezone: z.string().min(1).max(64).optional(),
  weekendDayIndices: z.array(z.number().int().min(0).max(6)).min(0).max(7).optional(),
  defaultWeekdayWindow: advisorDayWindowSchema.optional(),
  weekdayOverrides: z.record(z.string().regex(/^[0-6]$/), weekdayOverrideSchema).optional(),
  dateWindowOverrides: z.record(z.string().regex(/^\d{4}-\d{2}-\d{2}$/), weekdayOverrideSchema).optional(),
  slotIntervalMinutes: z.union([z.literal(30), z.literal(45), z.literal(60), z.literal(90)]).optional(),
  dailyBookingCapOverrides: z.record(z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.number().int().positive()).optional(),
  weeklyBookingCapOverrides: z.record(z.string().regex(/^\d{4}-W\d{1,2}$/), z.number().int().positive()).optional(),
  bookingHorizonDays: z.number().int().min(1).max(366).optional(),
});

function emptyRecordToUndefined<T extends Record<string, unknown>>(
  value: T | undefined,
): T | undefined {
  if (value === undefined) {
    return undefined;
  }
  return Object.keys(value).length > 0 ? value : undefined;
}

function mergeAdvisorSettings(
  base: AdvisorBookingSettingsDocument,
  patch: z.infer<typeof patchSchema>,
): AdvisorBookingSettingsDocument {
  const merged: AdvisorBookingSettingsDocument = {
    ...base,
    ...patch,
    weekdayOverrides:
      patch.weekdayOverrides !== undefined
        ? emptyRecordToUndefined(patch.weekdayOverrides)
        : base.weekdayOverrides,
    dateWindowOverrides:
      patch.dateWindowOverrides !== undefined
        ? emptyRecordToUndefined(patch.dateWindowOverrides)
        : base.dateWindowOverrides,
    dailyBookingCapOverrides:
      patch.dailyBookingCapOverrides !== undefined
        ? emptyRecordToUndefined(patch.dailyBookingCapOverrides)
        : base.dailyBookingCapOverrides,
    weeklyBookingCapOverrides:
      patch.weeklyBookingCapOverrides !== undefined
        ? emptyRecordToUndefined(patch.weeklyBookingCapOverrides)
        : base.weeklyBookingCapOverrides,
    updatedAt: new Date(),
  };
  return merged;
}

function withLockedAdvisorTimezone(doc: AdvisorBookingSettingsDocument): AdvisorBookingSettingsDocument {
  return { ...doc, timezone: PRIMARY_TIMEZONE };
}

/**
 * Loads persisted advisor booking settings, or the canonical defaults when no row exists yet.
 */
export async function GET(): Promise<NextResponse> {
  try {
    const existing = await findAdvisorBookingSettingsDocument();
    const settings = withLockedAdvisorTimezone(
      existing ?? createDefaultAdvisorBookingSettingsDocument(new Date()),
    );
    return NextResponse.json({ settings });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to load booking schedule.', details: message }, { status: 500 });
  }
}

/**
 * Upserts advisor booking settings (singleton).
 */
export async function PATCH(request: Request): Promise<NextResponse> {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }
  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: 'No fields to update.' }, { status: 400 });
  }
  try {
    const existing = await findAdvisorBookingSettingsDocument();
    const base = existing ?? createDefaultAdvisorBookingSettingsDocument(new Date());
    const merged = mergeAdvisorSettings(base, parsed.data);
    const materialized = materializeAdvisorBookingSettingsDocument(withLockedAdvisorTimezone(merged));
    const saved = await replaceAdvisorBookingSettingsDocument({
      ...materialized,
      updatedAt: merged.updatedAt,
    });
    return NextResponse.json({ settings: saved });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to save booking schedule.', details: message }, { status: 500 });
  }
}
