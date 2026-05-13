import type { QuizAnswers } from '@/domain/types';

/**
 * Returns the persisted guided diagnostic payload as a JSON string for storage on bookings.
 */
export function extractGuidedDiagnosticRawFromQuizAnswers(answers: QuizAnswers): string | null {
  const raw = answers.guidedDiagnostic as unknown;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (raw !== undefined && raw !== null && typeof raw === 'object') {
    try {
      const serialized = JSON.stringify(raw);
      return serialized.length > 0 ? serialized : null;
    } catch {
      return null;
    }
  }
  return null;
}
