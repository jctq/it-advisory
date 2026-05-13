'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useState, type ReactElement } from 'react';
import { Button } from '@/components/ui/button';
import type { VisitorQuizSessionSummary } from '@/lib/data/quiz-sessions';

const QUIZ_SESSION_API_URL = '/api/quiz/session';
const MY_SESSIONS_API_URL = '/api/quiz/my-sessions';

type AccountDiagnosticsPanelProps = {
  readonly initialSessions: readonly VisitorQuizSessionSummary[];
};

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat('en-PH', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Manila',
});

/**
 * Signed-in user UI: list diagnostics, start new, continue, or delete when not linked to a booking (any progress).
 */
export function AccountDiagnosticsPanel(props: AccountDiagnosticsPanelProps): ReactElement {
  const router = useRouter();
  const [actionError, setActionError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const executeCreateNew = useCallback(async (): Promise<void> => {
    setActionError(null);
    setIsCreating(true);
    try {
      const response = await fetch(MY_SESSIONS_API_URL, { method: 'POST', credentials: 'include' });
      const payload: unknown = await response.json();
      if (!response.ok) {
        const message =
          typeof payload === 'object' && payload !== null && 'error' in payload && typeof (payload as { error?: unknown }).error === 'string'
            ? (payload as { error: string }).error
            : 'Could not start a new diagnostic.';
        setActionError(message);
        return;
      }
      const sessionId =
        typeof payload === 'object' && payload !== null && 'sessionId' in payload && typeof (payload as { sessionId?: unknown }).sessionId === 'string'
          ? (payload as { sessionId: string }).sessionId
          : null;
      if (sessionId === null) {
        setActionError('Invalid response from server.');
        return;
      }
      router.push(`/quiz?sessionId=${encodeURIComponent(sessionId)}`);
    } finally {
      setIsCreating(false);
    }
  }, [router]);
  const executeDelete = useCallback(
    async (sessionId: string): Promise<void> => {
      if (!window.confirm('Delete this diagnostic permanently? This cannot be undone.')) {
        return;
      }
      setActionError(null);
      setDeletingId(sessionId);
      try {
        const response = await fetch(`${QUIZ_SESSION_API_URL}?sessionId=${encodeURIComponent(sessionId)}`, {
          method: 'DELETE',
          credentials: 'include',
        });
        const payload: unknown = await response.json().catch(() => ({}));
        if (!response.ok) {
          const message =
            typeof payload === 'object' && payload !== null && 'error' in payload && typeof (payload as { error?: unknown }).error === 'string'
              ? (payload as { error: string }).error
              : 'Delete failed.';
          setActionError(message);
          return;
        }
        await router.refresh();
      } finally {
        setDeletingId(null);
      }
    },
    [router],
  );
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          <strong className="text-foreground">View</strong> opens a booking-linked diagnostic as read-only.{' '}
          <strong className="text-foreground">Continue</strong> resumes editable sessions. You can{' '}
          <strong className="text-foreground">delete</strong> any diagnostic that is not booked (in progress or completed).{' '}
          <strong className="text-foreground">New diagnostic</strong> starts a separate session. Scheduled bookings stay
          on file and are not deleted here.
        </p>
        <Button type="button" onClick={() => void executeCreateNew()} disabled={isCreating}>
          {isCreating ? 'Starting…' : 'New diagnostic'}
        </Button>
      </div>
      {actionError !== null ? (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive" role="alert">
          {actionError}
        </p>
      ) : null}
      {props.initialSessions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/20 px-6 py-12 text-center text-sm text-muted-foreground">
          <p>No saved diagnostics yet.</p>
          <Button type="button" className="mt-4" asChild>
            <Link href="/quiz">Start your first diagnostic</Link>
          </Button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-border bg-muted/40">
              <tr>
                <th className="px-4 py-3 font-medium text-foreground">Booking</th>
                <th className="px-4 py-3 font-medium text-foreground">Updated</th>
                <th className="px-4 py-3 font-medium text-foreground">Status</th>
                <th className="px-4 py-3 font-medium text-foreground">Summary</th>
                <th className="px-4 py-3 font-medium text-foreground">Step</th>
                <th className="px-4 py-3 text-right font-medium text-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {props.initialSessions.map((row) => {
                const isComplete = row.completedAtIso !== null;
                return (
                  <tr key={row.id} className="border-b border-border/80 last:border-0">
                    <td className="px-4 py-3">
                      {row.isBooked ? (
                        <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">
                          Booked
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{DATE_TIME_FORMATTER.format(new Date(row.updatedAtIso))}</td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          isComplete
                            ? 'rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground'
                            : 'rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary'
                        }
                      >
                        {isComplete ? 'Completed' : 'In progress'}
                      </span>
                    </td>
                    <td className="max-w-xs px-4 py-3 text-muted-foreground">
                      {row.situationPreview !== null && row.situationPreview.length > 0 ? (
                        <span className="line-clamp-2" title={row.situationPreview}>
                          {row.situationPreview}
                        </span>
                      ) : row.hasGuidedDiagnostic ? (
                        <span className="text-xs">Guided diagnostic</span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{row.currentStep}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap justify-end gap-2">
                        {row.isBooked ? (
                          <Button type="button" variant="outline" size="sm" asChild>
                            <Link href={`/quiz?sessionId=${encodeURIComponent(row.id)}`}>View</Link>
                          </Button>
                        ) : (
                          <Button type="button" variant="outline" size="sm" asChild>
                            <Link href={`/quiz?sessionId=${encodeURIComponent(row.id)}`}>Continue</Link>
                          </Button>
                        )}
                        {!row.isBooked ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                            disabled={deletingId === row.id}
                            onClick={() => void executeDelete(row.id)}
                          >
                            {deletingId === row.id ? 'Deleting…' : 'Delete'}
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
