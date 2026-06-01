import type { VisitorDiagnosticSessionSummary } from '@/lib/data/diagnostic-session-types';

type SessionListRow = Pick<
  VisitorDiagnosticSessionSummary,
  'sessionTitlePreview' | 'situationPreview' | 'bookingReferenceId' | 'hasGuidedDiagnostic'
>;

/**
 * Primary label for diagnostic session lists (account UI, mobile cards).
 */
export function resolveAccountDiagnosticListTitle(row: SessionListRow): string {
  const title = row.sessionTitlePreview?.trim();
  if (title !== undefined && title.length > 0) {
    return title;
  }
  const summary = row.situationPreview?.trim();
  if (summary !== undefined && summary.length > 0) {
    return summary;
  }
  if (row.hasGuidedDiagnostic) {
    return 'Guided diagnostic';
  }
  return 'Diagnostic session';
}

/**
 * Secondary summary line when a distinct title is shown.
 */
export function resolveAccountDiagnosticListSummary(row: SessionListRow): string | null {
  const title = row.sessionTitlePreview?.trim() ?? '';
  const summary = row.situationPreview?.trim() ?? '';
  if (summary.length === 0) {
    return null;
  }
  if (title.length > 0 && summary === title) {
    return null;
  }
  return summary;
}
