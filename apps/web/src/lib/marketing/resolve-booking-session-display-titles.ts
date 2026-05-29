import 'server-only';
import { resolveQuizSessionDisplayPreview } from '@techmd/diagnostic-core/quiz-session-display-preview';
import type { ObjectId } from 'mongodb';
import { COLLECTIONS } from '@/domain/collections';
import type { BookingDocument, QuizAnswers, QuizSessionDocument } from '@/domain/types';
import { getCatalogServiceByKey } from '@/lib/data/public-catalog-services';
import type { BookingSessionDisplayTitles } from '@/lib/marketing/booking-session-display-titles';
import { extractGuidedDiagnosticRawFromQuizAnswers } from '@/lib/marketing/extract-guided-diagnostic-raw';
import { getDb } from '@/lib/mongodb';

function formatServiceKeyLabel(serviceKey: string): string {
  const parts = serviceKey.split(/[-_]/).filter((part) => part.length > 0);
  if (parts.length === 0) {
    return 'Consultation';
  }
  return parts
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}`)
    .join(' ');
}

function readSituationAnswerFromQuizAnswers(answers: QuizAnswers): string | null {
  const raw = answers.situation;
  if (typeof raw !== 'string') {
    return null;
  }
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

async function resolveSessionTitlePreviewFromBooking(
  booking: BookingDocument,
): Promise<string | null> {
  const snapshotRaw =
    typeof booking.guidedDiagnosticSnapshot === 'string' && booking.guidedDiagnosticSnapshot.trim().length > 0
      ? booking.guidedDiagnosticSnapshot.trim()
      : null;
  if (snapshotRaw !== null) {
    return resolveQuizSessionDisplayPreview({
      guidedDiagnosticRaw: snapshotRaw,
      situationAnswer: null,
    }).sessionTitlePreview;
  }
  const quizSessionId: ObjectId | undefined | null = booking.quizSessionId;
  if (quizSessionId === undefined || quizSessionId === null || !process.env.MONGODB_URI) {
    return null;
  }
  const db = await getDb();
  const sessionDoc = await db.collection<QuizSessionDocument>(COLLECTIONS.quizSessions).findOne({ _id: quizSessionId });
  if (sessionDoc === null) {
    return null;
  }
  const guidedRaw = extractGuidedDiagnosticRawFromQuizAnswers(sessionDoc.answers);
  return resolveQuizSessionDisplayPreview({
    guidedDiagnosticRaw: guidedRaw,
    situationAnswer: readSituationAnswerFromQuizAnswers(sessionDoc.answers),
  }).sessionTitlePreview;
}

/**
 * Resolves the personalized session headline and catalog service label for booking UI.
 */
export async function resolveBookingSessionDisplayTitles(
  booking: BookingDocument,
): Promise<BookingSessionDisplayTitles> {
  const catalogRow = await getCatalogServiceByKey(booking.serviceKey);
  const serviceTitle = catalogRow?.title ?? formatServiceKeyLabel(booking.serviceKey);
  const sessionTitle = await resolveSessionTitlePreviewFromBooking(booking);
  return {
    sessionTitle,
    serviceTitle,
  };
}
