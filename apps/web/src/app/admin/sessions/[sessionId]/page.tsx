import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ObjectId } from 'mongodb';
import { formatInTimeZone } from 'date-fns-tz';
import {
  BOOKING_SESSION_CALENDAR_DURATION_MINUTES,
  buildBookingCalendarLinkBundle,
} from '@techmd/domain/booking-calendar-links';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { BookingDiagnosticReadonly } from '@/components/admin/booking-diagnostic-readonly';
import { QuizSessionAuditTable } from '@/components/admin/quiz-session-audit-table';
import { findQuizSessionById, listQuizAuditForSession } from '@/lib/data/quiz-sessions';
import { formatBookingReferenceId } from '@/lib/marketing/booking-reference';

type AdminQuizSessionDetailPageProps = {
  readonly params: Promise<{ readonly sessionId: string }>;
};

export const metadata = {
  title: 'Session — TechMD Admin',
};

export const dynamic = 'force-dynamic';

function formatServiceKeyLabel(serviceKey: string): string {
  const parts = serviceKey.split(/[-_]/).filter((part) => part.length > 0);
  if (parts.length === 0) {
    return 'Consultation';
  }
  return parts
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}`)
    .join(' ');
}

export default async function AdminQuizSessionDetailPage(props: AdminQuizSessionDetailPageProps) {
  const { sessionId } = await props.params;
  const session = await findQuizSessionById(sessionId);
  if (session === null) {
    notFound();
  }
  const auditRows = await listQuizAuditForSession(new ObjectId(session.id));
  return (
    <section className="mx-auto space-y-8 w-full">
      <AdminPageHeader
        eyebrow="Intake"
        title="Session"
        description="Visitor diagnostic snapshot from database. Booked = a booking row points at this session id. Table: diagnostic thread, guided diagnostic tabs, save history."
      />
      <div className="flex flex-wrap gap-3 text-sm">
        <Link href="/admin/sessions" className="font-medium text-primary underline-offset-4 hover:underline">
          ← All sessions
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
              {formatInTimeZone(new Date(session.createdAtIso), 'Asia/Manila', 'MMM d, yyyy · h:mm a')}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Updated</dt>
            <dd className="mt-1 text-sm text-foreground">
              {formatInTimeZone(new Date(session.updatedAtIso), 'Asia/Manila', 'MMM d, yyyy · h:mm a')}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Completed</dt>
            <dd className="mt-1 text-sm text-foreground">
              {session.completedAtIso !== null
                ? formatInTimeZone(new Date(session.completedAtIso), 'Asia/Manila', 'MMM d, yyyy · h:mm a')
                : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Booked</dt>
            <dd className="mt-1 text-sm text-foreground">
              {session.linkedBookings.length === 0 ? (
                'No — no booking references this session id yet.'
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
            Web bookings that stored this session id (`bookings.quizSessionId`).
          </p>
          <ul className="mt-4 space-y-3">
            {session.linkedBookings.map((booking) => {
              const bookingReference = formatBookingReferenceId(booking.id);
              const startsAt = new Date(booking.startsAtIso);
              const meetingUrl =
                booking.meetingUrl !== null && booking.meetingUrl.trim().length > 0 ? booking.meetingUrl.trim() : '';
              const calendarBundle =
                booking.status === 'confirmed'
                  ? buildBookingCalendarLinkBundle({
                      title: `${formatServiceKeyLabel(booking.serviceKey)} — ${bookingReference}`,
                      description: `Booking reference ${bookingReference}. Session ${session.id}.`,
                      location: meetingUrl,
                      startsAtUtc: startsAt,
                      durationMinutes: BOOKING_SESSION_CALENDAR_DURATION_MINUTES,
                      icsUidSeed: bookingReference,
                    })
                  : null;
              return (
                <li key={booking.id} className="rounded-lg border border-border px-3 py-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-muted-foreground">
                      {formatInTimeZone(startsAt, booking.timezone, 'MMM d, yyyy · h:mm a')}{' '}
                      <span className="text-xs">({booking.timezone})</span> ·{' '}
                      <span className="font-medium text-foreground">{booking.status}</span>
                    </span>
                    <Link
                      href={`/admin/bookings/${booking.id}`}
                      className="font-medium text-primary underline-offset-4 hover:underline"
                    >
                      Open booking
                    </Link>
                  </div>
                  {calendarBundle !== null ? (
                    <div className="mt-2 flex flex-wrap gap-2 text-xs font-medium">
                      <a
                        href={calendarBundle.googleCalendarUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary underline-offset-4 hover:underline"
                      >
                        Google Calendar
                      </a>
                      <span className="text-muted-foreground">·</span>
                      <a
                        href={calendarBundle.outlookCalendarUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary underline-offset-4 hover:underline"
                      >
                        Outlook
                      </a>
                      <span className="text-muted-foreground">·</span>
                      <a
                        href={calendarBundle.icsDataUrl}
                        download={`booking-${bookingReference}.ics`}
                        className="text-primary underline-offset-4 hover:underline"
                      >
                        Apple (.ics)
                      </a>
                    </div>
                  ) : null}
                </li>
              );
            })}
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
