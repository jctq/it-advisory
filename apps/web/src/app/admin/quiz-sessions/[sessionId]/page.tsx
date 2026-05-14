import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ObjectId } from 'mongodb';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { BookingDiagnosticReadonly } from '@/components/admin/booking-diagnostic-readonly';
import { QuizSessionAuditTable } from '@/components/admin/quiz-session-audit-table';
import { findQuizSessionById, listQuizAuditForSession } from '@/lib/data/quiz-sessions';

type AdminQuizSessionDetailPageProps = {
  readonly params: Promise<{ readonly sessionId: string }>;
};

export const metadata = {
  title: 'Quiz session — IT Advisory Admin',
};

export const dynamic = 'force-dynamic';

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat('en-PH', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Manila',
});

export default async function AdminQuizSessionDetailPage(props: AdminQuizSessionDetailPageProps) {
  const { sessionId } = await props.params;
  const session = await findQuizSessionById(sessionId);
  if (session === null) {
    notFound();
  }
  const auditRows = await listQuizAuditForSession(new ObjectId(session.id));
  return (
    <section className="mx-auto space-y-8">
      <AdminPageHeader
        eyebrow="Intake"
        title="Quiz session"
        description="Visitor quiz snapshot from database. Booked = a booking row points at this session id. Table: diagnostic thread, guided diagnostic tabs, save history."
      />
      <div className="flex flex-wrap gap-3 text-sm">
        <Link href="/admin/quiz-sessions" className="font-medium text-primary underline-offset-4 hover:underline">
          ← All quiz sessions
        </Link>
      </div>
      <div className="rounded-2xl border border-border bg-card p-6 shadow-xs">
        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Session id</dt>
            <dd className="mt-1 font-mono text-sm text-foreground">{session.id}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Visitor</dt>
            <dd className="mt-1 font-mono text-sm text-foreground">{session.visitorId}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Linear step</dt>
            <dd className="mt-1 text-sm text-foreground">{session.currentStep}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Created</dt>
            <dd className="mt-1 text-sm text-foreground">
              {DATE_TIME_FORMATTER.format(new Date(session.createdAtIso))}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Updated</dt>
            <dd className="mt-1 text-sm text-foreground">
              {DATE_TIME_FORMATTER.format(new Date(session.updatedAtIso))}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Completed</dt>
            <dd className="mt-1 text-sm text-foreground">
              {session.completedAtIso !== null
                ? DATE_TIME_FORMATTER.format(new Date(session.completedAtIso))
                : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Booked</dt>
            <dd className="mt-1 text-sm text-foreground">
              {session.linkedBookings.length === 0 ? (
                'No — no booking references this quiz session id yet.'
              ) : (
                <span>
                  Yes — {session.linkedBookings.length} booking
                  {session.linkedBookings.length === 1 ? '' : 's'} (see below).
                </span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Guided diagnostic</dt>
            <dd className="mt-1 text-sm text-foreground">{session.guidedDiagnosticRaw !== null ? 'Stored' : 'Not stored'}</dd>
          </div>
        </dl>
      </div>
      {session.linkedBookings.length > 0 ? (
        <div className="rounded-2xl border border-border bg-card p-6 shadow-xs">
          <h2 className="text-lg font-semibold text-foreground">Linked bookings</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Web bookings that stored this quiz session id (`bookings.quizSessionId`).
          </p>
          <ul className="mt-4 space-y-2">
            {session.linkedBookings.map((booking) => (
              <li
                key={booking.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm"
              >
                <span className="text-muted-foreground">
                  {DATE_TIME_FORMATTER.format(new Date(booking.startsAtIso))} ·{' '}
                  <span className="font-medium text-foreground">{booking.status}</span>
                </span>
                <Link
                  href={`/admin/bookings/${booking.id}`}
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  Open booking
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {session.situationDiagnosticThread !== null ? (
        <details className="rounded-2xl border border-border bg-card p-6 shadow-xs">
          <summary className="cursor-pointer text-lg font-semibold text-foreground">Diagnostic thread JSON</summary>
          <p className="mt-2 text-sm text-muted-foreground">
            Denormalized thread used for AI rounds (initial prompt, Q&amp;A rounds, outcome fields when present).
          </p>
          <pre className="mt-4 max-h-96 overflow-auto rounded-lg border border-border bg-muted/40 p-3 text-xs">
            {session.situationDiagnosticThread}
          </pre>
        </details>
      ) : null}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-xs">
        <h2 className="text-lg font-semibold text-foreground">Guided diagnostic</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Full question blocks, selections, notes, guidance, and recommendation as stored on the session.
        </p>
        <div className="mt-6">
          <BookingDiagnosticReadonly guidedDiagnosticRaw={session.guidedDiagnosticRaw} />
        </div>
      </div>
      {auditRows.length > 0 ? (
        <div className="rounded-2xl border border-border bg-card p-6 shadow-xs">
          <h2 className="text-lg font-semibold text-foreground">Save history</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Append-only rows from quiz_audit (each quiz save). Use pagination and View to open the full answers JSON for
            a row.
          </p>
          <div className="mt-4">
            <QuizSessionAuditTable rows={auditRows} />
          </div>
        </div>
      ) : null}
    </section>
  );
}
