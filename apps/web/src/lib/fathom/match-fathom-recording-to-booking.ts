import { ObjectId } from 'mongodb';
import { COLLECTIONS } from '@/domain/collections';
import type { BookingDocument } from '@/domain/types';
import { formatBookingReferenceId } from '@/lib/marketing/booking-reference';
import { getDb } from '@/lib/mongodb';
import { getResolvedSiteName } from '@/lib/data/app-settings';
import { PROJECT_RESCUE_SERVICE_TITLE } from '@techmd/diagnostic-core/project-rescue-service-context';
import type { ParsedFathomWebhook } from '@/lib/fathom/parse-fathom-webhook-payload';
import { extractBookingReferenceCandidatesFromFathomText } from '@/lib/fathom/extract-booking-reference-from-fathom-text';

const DEFAULT_MATCH_WINDOW_MINUTES = 15 as const;
const OBJECT_ID_HEX_LENGTH = 24 as const;
const BOOKING_REFERENCE_LENGTH = 8 as const;

const FATHOM_MATCHABLE_BOOKING_STATUSES = ['confirmed', 'completed'] as const;

export type FathomBookingMatchResult =
  | { readonly status: 'linked'; readonly bookingId: string }
  | { readonly status: 'ambiguous'; readonly candidateBookingIds: readonly string[] }
  | { readonly status: 'unmatched' };

function resolveMatchWindowMs(): number {
  const raw = process.env.FATHOM_MATCH_WINDOW_MINUTES?.trim() ?? '';
  const minutes = raw.length > 0 ? Number.parseInt(raw, 10) : DEFAULT_MATCH_WINDOW_MINUTES;
  if (!Number.isFinite(minutes) || minutes < 1) {
    return DEFAULT_MATCH_WINDOW_MINUTES * 60_000;
  }
  return minutes * 60_000;
}

function formatServiceKeyLabel(serviceKey: string): string {
  const parts = serviceKey.split(/[-_]/).filter((part) => part.length > 0);
  if (parts.length === 0) {
    return 'Consultation';
  }
  return parts
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}`)
    .join(' ');
}

function buildExpectedTitles(input: {
  readonly serviceKey: string;
  readonly bookingId: string;
  readonly siteName: string;
  readonly serviceTitle: string;
}): string[] {
  const bookingReference = formatBookingReferenceId(input.bookingId);
  const serviceLabel = formatServiceKeyLabel(input.serviceKey);
  const zoomStyle =
    input.serviceKey === 'project-rescue'
      ? `${PROJECT_RESCUE_SERVICE_TITLE} consultation`
      : `Consultation · ${input.serviceKey}`;
  const meetStyle = `${input.siteName} · ${input.serviceTitle} — ${bookingReference}`;
  return [zoomStyle, meetStyle, serviceLabel, bookingReference, input.serviceKey];
}

function scoreTitleMatch(title: string, expectedTitles: readonly string[]): number {
  const normalizedTitle = title.toLowerCase();
  let score = 0;
  for (const expected of expectedTitles) {
    const needle = expected.toLowerCase();
    if (needle.length === 0) {
      continue;
    }
    if (normalizedTitle === needle) {
      score += 4;
    } else if (normalizedTitle.includes(needle)) {
      score += 2;
    }
  }
  return score;
}

async function matchFathomRecordingByBookingReference(
  references: readonly string[],
): Promise<FathomBookingMatchResult | null> {
  if (references.length === 0) {
    return null;
  }
  const db = await getDb();
  const bookingIds = new Set<string>();
  for (const reference of references) {
    const docs = await db
      .collection<BookingDocument>(COLLECTIONS.bookings)
      .find({
        status: { $in: [...FATHOM_MATCHABLE_BOOKING_STATUSES] },
        $expr: {
          $eq: [
            {
              $toUpper: {
                $substr: [{ $toString: '$_id' }, OBJECT_ID_HEX_LENGTH - BOOKING_REFERENCE_LENGTH, BOOKING_REFERENCE_LENGTH],
              },
            },
            reference,
          ],
        },
      })
      .toArray();
    for (const doc of docs) {
      if (doc._id instanceof ObjectId) {
        bookingIds.add(doc._id.toString());
      }
    }
  }
  if (bookingIds.size === 0) {
    return null;
  }
  if (bookingIds.size === 1) {
    return { status: 'linked', bookingId: [...bookingIds][0]! };
  }
  return {
    status: 'ambiguous',
    candidateBookingIds: [...bookingIds],
  };
}

async function matchFathomRecordingByTimeWindow(input: {
  readonly parsed: ParsedFathomWebhook;
  readonly hostEmail: string;
}): Promise<FathomBookingMatchResult> {
  const anchor = input.parsed.startedAt ?? new Date();
  const windowMs = resolveMatchWindowMs();
  const rangeStart = new Date(anchor.getTime() - windowMs);
  const rangeEnd = new Date(anchor.getTime() + windowMs);
  const db = await getDb();
  const docs = await db
    .collection<BookingDocument>(COLLECTIONS.bookings)
    .find({
      status: { $in: [...FATHOM_MATCHABLE_BOOKING_STATUSES] },
      startsAt: { $gte: rangeStart, $lte: rangeEnd },
    })
    .toArray();
  if (docs.length === 0) {
    return { status: 'unmatched' };
  }
  const siteName = await getResolvedSiteName();
  const scored: { readonly bookingId: string; readonly score: number }[] = [];
  for (const doc of docs) {
    const bookingId = doc._id instanceof ObjectId ? doc._id.toString() : '';
    if (bookingId.length === 0) {
      continue;
    }
    const serviceTitle = formatServiceKeyLabel(doc.serviceKey);
    const expectedTitles = buildExpectedTitles({
      serviceKey: doc.serviceKey,
      bookingId,
      siteName,
      serviceTitle,
    });
    let score = scoreTitleMatch(input.parsed.title, expectedTitles);
    if ((doc.meetingUrl?.trim() ?? '').length > 0) {
      score += 1;
    }
    const hostEmail = input.hostEmail.trim().toLowerCase();
    if (hostEmail.length > 0 && input.parsed.recordedByEmail.trim().toLowerCase() === hostEmail) {
      score += 1;
    }
    if (score > 0) {
      scored.push({ bookingId, score });
    }
  }
  if (scored.length === 0) {
    return { status: 'unmatched' };
  }
  scored.sort((left, right) => right.score - left.score);
  const topScore = scored[0]!.score;
  const topCandidates = scored.filter((row) => row.score === topScore);
  if (topCandidates.length === 1) {
    return { status: 'linked', bookingId: topCandidates[0]!.bookingId };
  }
  return {
    status: 'ambiguous',
    candidateBookingIds: topCandidates.map((row) => row.bookingId),
  };
}

export async function matchFathomRecordingToBooking(input: {
  readonly parsed: ParsedFathomWebhook;
  readonly hostEmail: string;
}): Promise<FathomBookingMatchResult> {
  if (!process.env.MONGODB_URI) {
    return { status: 'unmatched' };
  }
  const referenceCandidates = extractBookingReferenceCandidatesFromFathomText(input.parsed.title);
  const byReference = await matchFathomRecordingByBookingReference(referenceCandidates);
  if (byReference !== null) {
    return byReference;
  }
  return matchFathomRecordingByTimeWindow(input);
}
