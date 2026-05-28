'use client';

import Link from 'next/link';
import { formatInTimeZone } from 'date-fns-tz';
import {
  CalendarDays,
  ClipboardList,
  CreditCard,
  History,
  LayoutDashboard,
  MessageSquare,
  type LucideIcon,
} from 'lucide-react';
import { useMemo, type ReactElement } from 'react';
import { BookingDiagnosticReadonly } from '@/components/admin/booking-diagnostic-readonly';
import { AdminDetailTabsShell, type AdminDetailTabConfig } from '@/components/admin/admin-detail-tabs-shell';
import { AdminFathomNotesLink } from '@/components/admin/admin-fathom-notes-link';
import { AdminSessionPaymentSection } from '@/components/admin/admin-session-payment-section';
import { QuizSessionAuditTable } from '@/components/admin/quiz-session-audit-table';
import {
  listAvailableSessionDetailTabs,
  resolveSessionDetailTab,
  type SessionCheckoutTransaction,
  type SessionDetailTab,
  type SessionLinkedBookingRow,
} from '@/lib/admin/admin-detail-tab-routing';
import type { QuizAuditAdminRow, QuizSessionDetail } from '@/lib/data/quiz-session-types';
import { formatBookingReferenceId } from '@/lib/marketing/booking-reference';

export type {
  SessionCheckoutTransaction,
  SessionDetailTab,
  SessionLinkedBookingCalendarBundle,
  SessionLinkedBookingRow,
} from '@/lib/admin/admin-detail-tab-routing';

type SessionDetailTabConfig = AdminDetailTabConfig<SessionDetailTab> & {
  readonly icon: LucideIcon;
};

type AdminSessionDetailWorkspaceProps = {
  readonly initialTab: SessionDetailTab;
  readonly session: QuizSessionDetail;
  readonly auditRows: readonly QuizAuditAdminRow[];
  readonly checkoutTransaction: SessionCheckoutTransaction | null;
  readonly linkedBookingRows: readonly SessionLinkedBookingRow[];
};

const SESSION_TAB_CONFIGS: Record<SessionDetailTab, SessionDetailTabConfig> = {
  overview: { value: 'overview', label: 'Overview', icon: LayoutDashboard },
  payment: { value: 'payment', label: 'Payment', icon: CreditCard },
  'linked-bookings': { value: 'linked-bookings', label: 'Linked bookings', icon: CalendarDays },
  'diagnostic-thread': { value: 'diagnostic-thread', label: 'Diagnostic thread', icon: MessageSquare },
  'guided-diagnostic': { value: 'guided-diagnostic', label: 'Guided diagnostic', icon: ClipboardList },
  'save-history': { value: 'save-history', label: 'Save history', icon: History },
};

function buildAvailableSessionTabs(props: AdminSessionDetailWorkspaceProps): readonly SessionDetailTabConfig[] {
  return listAvailableSessionDetailTabs({
    hasCheckoutTransaction: props.checkoutTransaction !== null,
    linkedBookingCount: props.linkedBookingRows.length,
    hasDiagnosticThread: props.session.situationDiagnosticThread !== null,
    auditRowCount: props.auditRows.length,
  }).map((value) => SESSION_TAB_CONFIGS[value]);
}

function renderOverviewPanel(session: QuizSessionDetail): ReactElement {
  return (
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
                {session.linkedBookings.length === 1 ? '' : 's'} (see Linked bookings tab).
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
  );
}

function renderLinkedBookingsPanel(linkedBookingRows: readonly SessionLinkedBookingRow[]): ReactElement {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-xs">
      <h2 className="text-lg font-semibold text-foreground">Linked bookings</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Web bookings that stored this session id (`bookings.quizSessionId`).
      </p>
      <ul className="mt-4 space-y-3">
        {linkedBookingRows.map((booking) => {
          const bookingReference = formatBookingReferenceId(booking.id);
          const startsAt = new Date(booking.startsAtIso);
          const meetingUrl =
            booking.meetingUrl !== null && booking.meetingUrl.trim().length > 0 ? booking.meetingUrl.trim() : '';
          const calendarBundle = booking.calendarBundle;
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
              <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium">
                {meetingUrl.length > 0 ? (
                  <>
                    <a
                      href={meetingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline-offset-4 hover:underline"
                    >
                      Join meeting
                    </a>
                    <span className="text-muted-foreground">·</span>
                  </>
                ) : null}
                <AdminFathomNotesLink
                  fathomShareUrl={booking.fathomShareUrl}
                  recordingOptIn={booking.recordingOptIn}
                />
                {calendarBundle !== null ? (
                  <>
                    {meetingUrl.length > 0 || booking.fathomShareUrl !== null || booking.recordingOptIn ? (
                      <span className="text-muted-foreground">·</span>
                    ) : null}
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
                      download={calendarBundle.icsDownloadName}
                      className="text-primary underline-offset-4 hover:underline"
                    >
                      Apple (.ics)
                    </a>
                  </>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function AdminSessionDetailWorkspace(props: AdminSessionDetailWorkspaceProps): ReactElement {
  const basePath = `/admin/sessions/${props.session.id}`;
  const tabs = useMemo(() => buildAvailableSessionTabs(props), [props]);
  const availableTabValues = useMemo(() => tabs.map((tab) => tab.value), [tabs]);
  return (
    <AdminDetailTabsShell<SessionDetailTab>
      tabs={tabs}
      initialTab={props.initialTab}
      defaultTab="overview"
      resolveTab={(value) => resolveSessionDetailTab(value, availableTabValues)}
      ariaLabel="Session detail sections"
      basePath={basePath}
      shouldOmitTabFromUrl={(tab) => tab === 'overview'}
      renderPanel={(tab) => {
        if (tab === 'overview') {
          return renderOverviewPanel(props.session);
        }
        if (tab === 'payment' && props.checkoutTransaction !== null) {
          return (
            <AdminSessionPaymentSection
              sessionId={props.session.id}
              transactionId={props.checkoutTransaction.id}
              status={props.checkoutTransaction.status}
              gatewayId={props.checkoutTransaction.gatewayId}
              amountCentavos={props.checkoutTransaction.amountCentavos}
              bookingId={props.checkoutTransaction.bookingId}
              customerEmail={props.checkoutTransaction.customerEmail}
            />
          );
        }
        if (tab === 'linked-bookings' && props.linkedBookingRows.length > 0) {
          return renderLinkedBookingsPanel(props.linkedBookingRows);
        }
        if (tab === 'diagnostic-thread' && props.session.situationDiagnosticThread !== null) {
          return (
            <div className="rounded-2xl border border-border bg-card p-6 shadow-xs">
              <h2 className="text-lg font-semibold text-foreground">Diagnostic thread JSON</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Denormalized thread used for AI rounds (initial prompt, Q&amp;A rounds, outcome fields when present).
              </p>
              <pre className="mt-4 max-h-96 overflow-auto rounded-lg border border-border bg-muted/40 p-3 text-xs">
                {props.session.situationDiagnosticThread}
              </pre>
            </div>
          );
        }
        if (tab === 'guided-diagnostic') {
          return (
            <div className="rounded-2xl border border-border bg-card p-6 shadow-xs">
              <h2 className="text-lg font-semibold text-foreground">Guided diagnostic</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Full question blocks, selections, notes, guidance, and recommendation as stored on the session.
              </p>
              <div className="mt-6">
                <BookingDiagnosticReadonly guidedDiagnosticRaw={props.session.guidedDiagnosticRaw} />
              </div>
            </div>
          );
        }
        if (tab === 'save-history' && props.auditRows.length > 0) {
          return (
            <div className="rounded-2xl border border-border bg-card p-6 shadow-xs">
              <h2 className="text-lg font-semibold text-foreground">Save history</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Append-only rows from quiz_audit (each quiz save). Use pagination and View to open the full answers JSON
                for a row.
              </p>
              <div className="mt-4">
                <QuizSessionAuditTable rows={props.auditRows} />
              </div>
            </div>
          );
        }
        return null;
      }}
    />
  );
}
