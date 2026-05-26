'use client';

import { useState, type FormEvent, type ReactElement } from 'react';
import type { BookingDetailRow } from '@/lib/data/bookings';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { buildApiUrl } from '@/lib/config/build-api-url';
import { notifyError, notifySuccess } from '@/lib/notify';

type AdminBookingFathomSectionProps = {
  readonly booking: BookingDetailRow;
};

export function AdminBookingFathomSection(props: AdminBookingFathomSectionProps): ReactElement {
  const [recordingId, setRecordingId] = useState<string>(props.booking.fathomRecordingId ?? '');
  const [shareUrl, setShareUrl] = useState<string>(props.booking.fathomShareUrl ?? '');
  const [sendEmail, setSendEmail] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const executeLink = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setIsSaving(true);
    try {
      const response = await fetch(buildApiUrl(`/api/admin/bookings/${props.booking.id}/fathom`), {
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
      window.location.reload();
    } catch (error: unknown) {
      notifyError(error instanceof Error ? error.message : 'Link failed.');
    } finally {
      setIsSaving(false);
    }
  };
  const [isSyncingOptIn, setIsSyncingOptIn] = useState<boolean>(false);
  const statusLabel = props.booking.fathomMatchStatus ?? (props.booking.recordingOptIn ? 'pending' : 'skipped');
  const executeSyncOptInFromPayment = async (): Promise<void> => {
    setIsSyncingOptIn(true);
    try {
      const response = await fetch(buildApiUrl(`/api/admin/bookings/${props.booking.id}/sync-recording-opt-in`), {
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
      window.location.reload();
    } catch (error: unknown) {
      notifyError(error instanceof Error ? error.message : 'Sync failed.');
    } finally {
      setIsSyncingOptIn(false);
    }
  };
  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-xs">
      <h2 className="text-lg font-semibold text-foreground">Meeting notes (Fathom)</h2>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recording opt-in</dt>
          <dd className="mt-1 flex flex-wrap items-center gap-2 text-sm text-foreground">
            <span>{props.booking.recordingOptIn ? 'Yes' : 'No'}</span>
            {!props.booking.recordingOptIn && props.booking.paymentTransactionId !== null ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isSyncingOptIn}
                onClick={() => void executeSyncOptInFromPayment()}
              >
                {isSyncingOptIn ? 'Syncing…' : 'Sync from checkout'}
              </Button>
            ) : null}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Match status</dt>
          <dd className="mt-1 text-sm text-foreground">{statusLabel}</dd>
        </div>
        {props.booking.recordingOptInPriceCentavos !== null && props.booking.recordingOptIn ? (
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Opt-in surcharge</dt>
            <dd className="mt-1 text-sm text-foreground">
              ₱{(props.booking.recordingOptInPriceCentavos / 100).toFixed(2)}
            </dd>
          </div>
        ) : null}
      </dl>
      {props.booking.fathomShareUrl !== undefined && props.booking.fathomShareUrl.trim().length > 0 ? (
        <p className="mt-4 text-sm">
          <a
            href={props.booking.fathomShareUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Open Fathom notes
          </a>
        </p>
      ) : null}
      {props.booking.fathomSummary !== undefined && props.booking.fathomSummary.trim().length > 0 ? (
        <p className="mt-4 whitespace-pre-wrap text-sm text-muted-foreground">{props.booking.fathomSummary}</p>
      ) : null}
      {props.booking.fathomActionItems !== undefined && props.booking.fathomActionItems.length > 0 ? (
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          {props.booking.fathomActionItems.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : null}
      <form className="mt-6 space-y-3 border-t border-border pt-4" onSubmit={(event) => void executeLink(event)}>
        <p className="text-sm font-medium text-foreground">Manual link</p>
        <div>
          <Label htmlFor="fathom-recording-id">Fathom recording id</Label>
          <Input
            id="fathom-recording-id"
            value={recordingId}
            onChange={(event) => setRecordingId(event.target.value)}
            className="mt-2 font-mono text-sm"
          />
        </div>
        <div>
          <Label htmlFor="fathom-share-url">Share URL</Label>
          <Input
            id="fathom-share-url"
            type="url"
            value={shareUrl}
            onChange={(event) => setShareUrl(event.target.value)}
            className="mt-2"
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={sendEmail} onChange={(event) => setSendEmail(event.target.checked)} />
          Email customer after linking
        </label>
        <Button type="submit" size="sm" disabled={isSaving}>
          {isSaving ? 'Saving…' : 'Link recording'}
        </Button>
      </form>
    </div>
  );
}
