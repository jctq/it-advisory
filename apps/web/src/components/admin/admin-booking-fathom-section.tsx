'use client';

import {
  CheckCircle2,
  CircleAlert,
  Clock3,
  ExternalLink,
  FileText,
  Link2,
  RefreshCw,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent, type ReactElement } from 'react';
import type { FathomMatchStatus } from '@/domain/recording-types';
import { AdminFathomNotesLink } from '@/components/admin/admin-fathom-notes-link';
import { AdminScrollArea } from '@/components/admin/admin-scroll-area';
import { MarketingBlogProse } from '@/components/marketing/blog/marketing-blog-prose';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { buildApiUrl } from '@/lib/config/build-api-url';
import type { BookingDetailRow } from '@/lib/data/bookings';
import { formatPaymentAmountLabel } from '@/lib/payments/format-payment-amount-label';
import { notifyError, notifySuccess } from '@/lib/notify';
import { cn } from '@/lib/utils';

type AdminBookingFathomSectionProps = {
  readonly booking: BookingDetailRow;
};

type RecordingFieldProps = {
  readonly label: string;
  readonly children: ReactElement | string;
  readonly className?: string;
};

function RecordingField(props: RecordingFieldProps): ReactElement {
  return (
    <div className={cn('space-y-1', props.className)}>
      <p className="text-xs font-medium text-muted-foreground">{props.label}</p>
      <div className="text-sm text-foreground">{props.children}</div>
    </div>
  );
}

function resolveMatchStatusLabel(status: FathomMatchStatus): string {
  if (status === 'pending') {
    return 'Pending match';
  }
  if (status === 'linked') {
    return 'Linked';
  }
  if (status === 'manual') {
    return 'Manually linked';
  }
  if (status === 'ambiguous') {
    return 'Needs review';
  }
  if (status === 'unmatched') {
    return 'Unmatched';
  }
  return 'Not opted in';
}

function resolveMatchStatusBadgeVariant(
  status: FathomMatchStatus,
): 'default' | 'secondary' | 'outline' | 'destructive' {
  if (status === 'linked' || status === 'manual') {
    return 'default';
  }
  if (status === 'pending') {
    return 'secondary';
  }
  if (status === 'ambiguous' || status === 'unmatched') {
    return 'destructive';
  }
  return 'outline';
}

function resolveNotesStatus(booking: BookingDetailRow): {
  readonly tone: 'ready' | 'pending' | 'unavailable';
  readonly title: string;
  readonly description: string;
} {
  const shareUrl = booking.fathomShareUrl?.trim() ?? '';
  if (shareUrl.length > 0) {
    return {
      tone: 'ready',
      title: 'Notes are ready',
      description: 'Share the Fathom link with your team or open it to review the summary.',
    };
  }
  if (booking.recordingOptIn) {
    return {
      tone: 'pending',
      title: 'Waiting for Fathom',
      description: 'The customer opted in. Notes appear here after the webhook links a recording or you add a share URL below.',
    };
  }
  return {
    tone: 'unavailable',
    title: 'Recording not opted in',
    description: 'This booking did not include AI meeting notes at checkout.',
  };
}

export function AdminBookingFathomSection(props: AdminBookingFathomSectionProps): ReactElement {
  const router = useRouter();
  const { booking } = props;
  const [recordingId, setRecordingId] = useState<string>(booking.fathomRecordingId ?? '');
  const [shareUrl, setShareUrl] = useState<string>(booking.fathomShareUrl ?? '');
  const [sendEmail, setSendEmail] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isSyncingOptIn, setIsSyncingOptIn] = useState<boolean>(false);
  const matchStatus: FathomMatchStatus =
    booking.fathomMatchStatus ?? (booking.recordingOptIn ? 'pending' : 'skipped');
  const notesStatus = resolveNotesStatus(booking);
  const trimmedShareUrl = booking.fathomShareUrl?.trim() ?? '';
  const hasShareUrl = trimmedShareUrl.length > 0;
  const surchargeLabel =
    booking.recordingOptIn &&
    booking.recordingOptInPriceCentavos !== null &&
    booking.recordingOptInPriceCentavos > 0
      ? formatPaymentAmountLabel(booking.recordingOptInPriceCentavos)
      : booking.recordingOptIn
        ? 'Included'
        : null;
  const executeLink = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setIsSaving(true);
    try {
      const response = await fetch(buildApiUrl(`/api/admin/bookings/${booking.id}/fathom`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fathomRecordingId: recordingId.trim().length > 0 ? recordingId.trim() : undefined,
          fathomShareUrl: shareUrl.trim().length > 0 ? shareUrl.trim() : undefined,
          sendCustomerEmail: sendEmail,
        }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(typeof data.error === 'string' ? data.error : 'Link failed');
      }
      notifySuccess('Fathom recording linked.');
      router.refresh();
    } catch (error: unknown) {
      notifyError(error instanceof Error ? error.message : 'Link failed.');
    } finally {
      setIsSaving(false);
    }
  };
  const executeSyncOptInFromPayment = async (): Promise<void> => {
    setIsSyncingOptIn(true);
    try {
      const response = await fetch(buildApiUrl(`/api/admin/bookings/${booking.id}/sync-recording-opt-in`), {
        method: 'POST',
      });
      const data = (await response.json()) as { ok?: boolean; reason?: string };
      if (!response.ok || data.ok !== true) {
        throw new Error(
          data.reason === 'no_transaction'
            ? 'No payment transaction linked to this booking.'
            : 'Could not sync opt-in from checkout.',
        );
      }
      notifySuccess('Recording opt-in synced from payment.');
      router.refresh();
    } catch (error: unknown) {
      notifyError(error instanceof Error ? error.message : 'Sync failed.');
    } finally {
      setIsSyncingOptIn(false);
    }
  };
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-card p-6 shadow-xs">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 space-y-1">
            <h2 className="text-lg font-semibold text-foreground">Meeting notes</h2>
            <p className="text-sm text-muted-foreground">Fathom AI notes and recording linked to this consultation.</p>
          </div>
          <Badge variant={resolveMatchStatusBadgeVariant(matchStatus)}>{resolveMatchStatusLabel(matchStatus)}</Badge>
        </div>
        <div
          className={cn(
            'mt-4 rounded-xl border px-4 py-4',
            notesStatus.tone === 'ready' && 'border-emerald-500/30 bg-emerald-500/5',
            notesStatus.tone === 'pending' && 'border-border/80 bg-muted/15',
            notesStatus.tone === 'unavailable' && 'border-border/70 bg-muted/10',
          )}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              {notesStatus.tone === 'ready' ? (
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
              ) : notesStatus.tone === 'pending' ? (
                <Clock3 className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
              ) : (
                <CircleAlert className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
              )}
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">{notesStatus.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{notesStatus.description}</p>
              </div>
            </div>
            {hasShareUrl ? (
              <Button asChild size="sm" className="gap-2 shrink-0">
                <a href={trimmedShareUrl} target="_blank" rel="noopener noreferrer">
                  <FileText className="size-4" aria-hidden />
                  Open notes
                  <ExternalLink className="size-3.5 opacity-70" aria-hidden />
                </a>
              </Button>
            ) : (
              <div className="text-sm">
                <AdminFathomNotesLink fathomShareUrl={null} recordingOptIn={booking.recordingOptIn} />
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="rounded-2xl border border-border bg-card p-6 shadow-xs">
        <h3 className="text-sm font-semibold text-foreground">Recording setup</h3>
        <p className="mt-1 text-sm text-muted-foreground">Checkout opt-in, surcharge, and automatic matching status.</p>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <RecordingField label="Customer opted in">{booking.recordingOptIn ? 'Yes' : 'No'}</RecordingField>
          <RecordingField label="Match status">{resolveMatchStatusLabel(matchStatus)}</RecordingField>
          {surchargeLabel !== null ? (
            <RecordingField label="Recording fee">
              <span className="tabular-nums font-medium">{surchargeLabel}</span>
            </RecordingField>
          ) : null}
          {booking.fathomRecordingId !== undefined && booking.fathomRecordingId.trim().length > 0 ? (
            <RecordingField label="Fathom recording ID" className="sm:col-span-2">
              <span className="font-mono text-xs">{booking.fathomRecordingId}</span>
            </RecordingField>
          ) : null}
        </dl>
        {!booking.recordingOptIn && booking.paymentTransactionId !== null ? (
          <div className="mt-4 rounded-xl border border-border/70 bg-muted/15 px-4 py-3">
            <p className="text-sm text-muted-foreground">
              Opt-in may be missing if checkout metadata was not saved. Sync from the linked payment transaction.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3 gap-2"
              disabled={isSyncingOptIn}
              onClick={() => void executeSyncOptInFromPayment()}
            >
              <RefreshCw className={cn('size-4', isSyncingOptIn && 'animate-spin')} aria-hidden />
              {isSyncingOptIn ? 'Syncing…' : 'Sync from checkout'}
            </Button>
          </div>
        ) : null}
      </div>
      {booking.fathomSummary !== undefined && booking.fathomSummary.trim().length > 0 ? (
        <div className="rounded-2xl border border-border bg-card p-6 shadow-xs">
          <h3 className="text-sm font-semibold text-foreground">Summary preview</h3>
          <p className="mt-1 text-sm text-muted-foreground">Excerpt from the linked Fathom notes.</p>
          <AdminScrollArea className="mt-4 max-h-128 rounded-xl border border-border/80 bg-muted/15" viewportClassName="p-4">
            <MarketingBlogProse contentMarkdown={booking.fathomSummary} />
          </AdminScrollArea>
          {booking.fathomActionItems !== undefined && booking.fathomActionItems.length > 0 ? (
            <div className="mt-4">
              <p className="text-xs font-medium text-muted-foreground">Action items</p>
              <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-foreground">
                {booking.fathomActionItems.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-xs">
        <div className="flex items-start gap-2">
          <Link2 className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
          <div>
            <h3 className="text-sm font-semibold text-foreground">Link recording manually</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Paste a Fathom recording id or share URL if the webhook did not match automatically.
            </p>
          </div>
        </div>
        <form className="mt-4 max-w-lg space-y-4" onSubmit={(event) => void executeLink(event)}>
          <div className="space-y-2">
            <Label htmlFor="fathom-recording-id">Fathom recording ID</Label>
            <Input
              id="fathom-recording-id"
              value={recordingId}
              onChange={(event) => setRecordingId(event.target.value)}
              placeholder="Optional — from Fathom dashboard"
              className="font-mono text-sm"
              disabled={isSaving}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fathom-share-url">Share URL</Label>
            <Input
              id="fathom-share-url"
              type="url"
              value={shareUrl}
              onChange={(event) => setShareUrl(event.target.value)}
              placeholder="https://fathom.video/share/…"
              disabled={isSaving}
            />
            <p className="text-xs text-muted-foreground">Customers receive this link when email after linking is enabled.</p>
          </div>
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border/70 bg-muted/10 px-3 py-3 text-sm">
            <Checkbox
              checked={sendEmail}
              disabled={isSaving}
              onCheckedChange={(checked) => setSendEmail(checked === true)}
            />
            <span>
              <span className="font-medium text-foreground">Email customer after linking</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">Sends the notes URL using your configured email template.</span>
            </span>
          </label>
          <Button type="submit" disabled={isSaving || (recordingId.trim().length === 0 && shareUrl.trim().length === 0)}>
            {isSaving ? 'Saving…' : 'Link recording'}
          </Button>
        </form>
      </div>
    </div>
  );
}
