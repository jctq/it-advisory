'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactElement } from 'react';
import { AlertCircle, AlertTriangle, ExternalLink, Info, Loader2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { buildApiUrl } from '@/lib/config/build-api-url';
import type { AdminClientDiagnosticReport, AdminDiagnosticIssue } from '@/lib/data/admin-client-diagnostic';
import { cn } from '@/lib/utils';

const CLIENT_DIAGNOSTIC_API_URL = buildApiUrl('/api/admin/client-diagnostic');

type AdminClientDiagnosticWorkspaceProps = {
  readonly initialDiagnostic: string;
  readonly initialReference: string;
};

export function AdminClientDiagnosticWorkspace(props: AdminClientDiagnosticWorkspaceProps): ReactElement {
  const router = useRouter();
  const [diagnosticInput, setDiagnosticInput] = useState(props.initialDiagnostic);
  const [referenceInput, setReferenceInput] = useState(props.initialReference);
  const [syncedInitialDiagnostic, setSyncedInitialDiagnostic] = useState(props.initialDiagnostic);
  const [syncedInitialReference, setSyncedInitialReference] = useState(props.initialReference);
  if (
    props.initialDiagnostic !== syncedInitialDiagnostic ||
    props.initialReference !== syncedInitialReference
  ) {
    setSyncedInitialDiagnostic(props.initialDiagnostic);
    setSyncedInitialReference(props.initialReference);
    setDiagnosticInput(props.initialDiagnostic);
    setReferenceInput(props.initialReference);
  }
  const [report, setReport] = useState<AdminClientDiagnosticReport | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const executeLookup = useCallback(async (diagnostic: string, reference: string): Promise<void> => {
    const diagnosticTrimmed = diagnostic.trim();
    const referenceTrimmed = reference.trim();
    if (diagnosticTrimmed.length === 0 && referenceTrimmed.length === 0) {
      setErrorMessage('Enter a diagnostic session id/ref and/or a booking reference.');
      setReport(null);
      return;
    }
    if (referenceTrimmed.length > 0 && referenceTrimmed.length < 4) {
      setErrorMessage('Booking reference must be at least four characters.');
      setReport(null);
      return;
    }
    setIsLoading(true);
    setErrorMessage(null);
    setReport(null);
    try {
      const params = new URLSearchParams();
      if (diagnosticTrimmed.length > 0) {
        params.set('diagnostic', diagnosticTrimmed);
      }
      if (referenceTrimmed.length > 0) {
        params.set('reference', referenceTrimmed);
      }
      const response = await fetch(`${CLIENT_DIAGNOSTIC_API_URL}?${params.toString()}`, { cache: 'no-store' });
      const payload = (await response.json()) as {
        ok?: boolean;
        report?: AdminClientDiagnosticReport;
        error?: string;
      };
      if (payload.report !== undefined) {
        setReport(payload.report);
      }
      if (!response.ok || payload.ok !== true) {
        throw new Error(typeof payload.error === 'string' ? payload.error : 'Diagnostic failed.');
      }
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : 'Diagnostic failed.');
    } finally {
      setIsLoading(false);
    }
  }, []);
  const lastAutoLookupKeyRef = useRef<string | null>(null);
  useEffect(() => {
    const diagnostic = props.initialDiagnostic.trim();
    const reference = props.initialReference.trim();
    if (diagnostic.length === 0 && reference.length < 4) {
      return;
    }
    const lookupKey = `${diagnostic}|${reference}`;
    if (lastAutoLookupKeyRef.current === lookupKey) {
      return;
    }
    lastAutoLookupKeyRef.current = lookupKey;
    void executeLookup(diagnostic, reference);
  }, [props.initialDiagnostic, props.initialReference, executeLookup]);
  const executeSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const nextParams = new URLSearchParams();
    const diagnosticTrimmed = diagnosticInput.trim();
    const referenceTrimmed = referenceInput.trim();
    if (diagnosticTrimmed.length > 0) {
      nextParams.set('diagnostic', diagnosticTrimmed);
    }
    if (referenceTrimmed.length > 0) {
      nextParams.set('reference', referenceTrimmed);
    }
    const query = nextParams.toString();
    router.replace(query.length > 0 ? `/admin/debug?${query}` : '/admin/debug');
    void executeLookup(diagnosticTrimmed, referenceTrimmed);
  };
  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Troubleshoot a visitor&apos;s guided diagnostic and booking checkout. Use a marketing session ref (24-char hex
        or qs1.* token from /diagnostic or /book URLs), a booking reference suffix, or both.
      </p>
      <form
        className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-xs"
        onSubmit={executeSubmit}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="admin-client-diagnostic-session">Diagnostic id / session ref</Label>
            <Input
              id="admin-client-diagnostic-session"
              name="diagnostic"
              value={diagnosticInput}
              onChange={(event) => setDiagnosticInput(event.target.value)}
              placeholder="qs1.… or 6a0463e77aa425f02d1c44fe"
              className="font-mono text-sm"
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="admin-client-diagnostic-reference">Booking reference</Label>
            <Input
              id="admin-client-diagnostic-reference"
              name="reference"
              value={referenceInput}
              onChange={(event) => setReferenceInput(event.target.value)}
              placeholder="e.g. D1C4510"
              className="font-mono uppercase tracking-wider"
              autoComplete="off"
              spellCheck={false}
            />
          </div>
        </div>
        <Button type="submit" className="gap-2" disabled={isLoading}>
          {isLoading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Search className="size-4" aria-hidden />}
          Run diagnostic
        </Button>
      </form>
      {errorMessage !== null ? (
        <div className="flex gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>{errorMessage}</p>
        </div>
      ) : null}
      {report !== null ? <DiagnosticReportView report={report} /> : null}
    </div>
  );
}

function DiagnosticReportView(props: { readonly report: AdminClientDiagnosticReport }): ReactElement {
  const { report } = props;
  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-border bg-muted/30 p-4 text-sm">
        <p className="font-semibold text-foreground">Platform</p>
        <dl className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <MetaItem label="Payment policy" value={report.platform.paymentPolicy} />
          <MetaItem label="Payments enabled" value={report.platform.paymentsEnabled ? 'yes' : 'no'} />
          <MetaItem label="Gateways" value={String(report.platform.configuredGatewayCount)} />
          <MetaItem label="Manage booking" value={report.platform.manageBookingEnabled ? 'enabled' : 'disabled'} />
          <MetaItem label="Diagnostic AI" value={report.platform.diagnosticAiEnabled ? 'enabled' : 'disabled'} />
          <MetaItem
            label="QUIZ_SESSION_URL_SECRET"
            value={report.platform.quizUrlSecretConfigured ? 'configured' : 'missing'}
          />
        </dl>
        {report.lookup.resolvedSessionHex !== null ? (
          <p className="mt-3 font-mono text-xs text-muted-foreground">Resolved session: {report.lookup.resolvedSessionHex}</p>
        ) : null}
      </section>
      {report.issues.length > 0 ? (
        <IssuesBlock title="Platform & lookup" issues={report.issues} />
      ) : null}
      {report.sessions.map((session) => (
        <section key={session.sessionId} className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-xs">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Diagnostic session</p>
              <p className="mt-1 font-mono text-sm text-foreground">{session.sessionId}</p>
              <p className="mt-1 break-all font-mono text-xs text-muted-foreground">{session.marketingRef}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" asChild>
                <Link href={session.adminSessionUrl}>Admin session</Link>
              </Button>
              <Button type="button" variant="secondary" size="sm" asChild>
                <Link href={session.diagnosticUrl} target="_blank" rel="noopener noreferrer" className="gap-1">
                  Open diagnostic
                  <ExternalLink className="size-3.5" aria-hidden />
                </Link>
              </Button>
              <Button type="button" variant="secondary" size="sm" asChild>
                <Link href={session.bookUrl} target="_blank" rel="noopener noreferrer" className="gap-1">
                  Open book flow
                  <ExternalLink className="size-3.5" aria-hidden />
                </Link>
              </Button>
            </div>
          </div>
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <MetaItem label="Visitor" value={session.visitorId} mono />
            <MetaItem label="Step" value={String(session.currentStep)} />
            <MetaItem label="Guided diagnostic" value={session.hasGuidedDiagnostic ? 'present' : 'missing'} />
            <MetaItem label="Completed" value={session.completedAtIso ?? '—'} />
            <MetaItem label="Linked bookings" value={session.linkedBookingIds.join(', ') || '—'} mono />
            <MetaItem
              label="Latest payment tx"
              value={
                session.latestPaymentTransaction !== null
                  ? `${session.latestPaymentTransaction.status} (${session.latestPaymentTransaction.id})`
                  : '—'
              }
              mono
            />
          </dl>
          <IssuesBlock title="Session checks" issues={session.issues} />
        </section>
      ))}
      {report.bookings.map((booking) => (
        <section key={booking.bookingId} className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-xs">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Booking</p>
              <p className="mt-1 font-mono text-lg font-semibold tracking-wider text-foreground">{booking.bookingReference}</p>
              <p className="mt-1 font-mono text-xs text-muted-foreground">{booking.bookingId}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" asChild>
                <Link href={booking.adminBookingUrl}>Admin booking</Link>
              </Button>
              <Button type="button" variant="secondary" size="sm" asChild>
                <Link href={booking.manageBookingUrl} target="_blank" rel="noopener noreferrer" className="gap-1">
                  Manage / pay
                  <ExternalLink className="size-3.5" aria-hidden />
                </Link>
              </Button>
            </div>
          </div>
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <MetaItem label="Status" value={booking.status} />
            <MetaItem label="Visitor" value={booking.visitorId} mono />
            <MetaItem label="Service" value={booking.serviceKey} />
            <MetaItem label="Starts" value={booking.startsAtIso} />
            <MetaItem label="Lead email" value={booking.lead.email ?? 'missing'} />
            <MetaItem label="Quiz session" value={booking.quizSessionId ?? '—'} mono />
            <MetaItem label="Payability" value={booking.payability.code} />
            <MetaItem label="Payment status" value={booking.paymentStatus ?? '—'} />
          </dl>
          <IssuesBlock title="Booking checks" issues={booking.issues} />
          <details className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-3 text-sm">
            <summary className="cursor-pointer font-semibold text-foreground">Payability debug JSON</summary>
            <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap break-all font-mono text-[11px] leading-relaxed">
              {JSON.stringify(
                {
                  general: booking.payability.debug,
                  accountOwner: booking.accountOwnerCheckout?.debug ?? null,
                },
                null,
                2,
              )}
            </pre>
          </details>
        </section>
      ))}
    </div>
  );
}

function MetaItem(props: { readonly label: string; readonly value: string; readonly mono?: boolean }): ReactElement {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{props.label}</dt>
      <dd className={cn('mt-0.5 text-foreground', props.mono === true && 'break-all font-mono text-xs')}>{props.value}</dd>
    </div>
  );
}

function IssuesBlock(props: { readonly title: string; readonly issues: readonly AdminDiagnosticIssue[] }): ReactElement {
  if (props.issues.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No issues reported for {props.title.toLowerCase()}.</p>
    );
  }
  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold text-foreground">{props.title}</p>
      <ul className="space-y-2">
        {props.issues.map((issue) => (
          <IssueRow key={`${issue.code}-${issue.title}`} issue={issue} />
        ))}
      </ul>
    </div>
  );
}

function IssueRow(props: { readonly issue: AdminDiagnosticIssue }): ReactElement {
  const Icon =
    props.issue.severity === 'error'
      ? AlertCircle
      : props.issue.severity === 'warn'
        ? AlertTriangle
        : Info;
  return (
    <li
      className={cn(
        'flex gap-3 rounded-lg border px-3 py-2 text-sm',
        props.issue.severity === 'error' && 'border-destructive/30 bg-destructive/5 text-destructive',
        props.issue.severity === 'warn' && 'border-amber-500/30 bg-amber-500/5 text-amber-950 dark:text-amber-100',
        props.issue.severity === 'info' && 'border-border bg-muted/40 text-foreground',
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">
          <span className="font-mono text-xs opacity-80">{props.issue.code}</span>
          {' — '}
          {props.issue.title}
        </p>
        <p className="mt-0.5 opacity-90">{props.issue.message}</p>
        {props.issue.debug !== undefined ? (
          <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap break-all rounded bg-background/60 p-2 font-mono text-[10px]">
            {JSON.stringify(props.issue.debug, null, 2)}
          </pre>
        ) : null}
      </div>
    </li>
  );
}
