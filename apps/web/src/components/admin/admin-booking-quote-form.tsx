'use client';

import { useState, type ReactElement } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { buildApiUrl } from '@/lib/config/build-api-url';
import { notifyError, notifySuccess } from '@/lib/notify';

type AdminBookingQuoteFormProps = {
  readonly bookingId: string;
  readonly status: string;
  readonly initialQuotedAmountCentavos: number | null;
  readonly initialQuoteExpiresAtIso: string | null;
  readonly catalogAmountLabel: string;
};

function centavosToPesos(amountCentavos: number | null): string {
  if (amountCentavos === null) {
    return '';
  }
  return (amountCentavos / 100).toFixed(2);
}

function toDatetimeLocalValue(iso: string | null): string {
  if (iso === null) {
    return '';
  }
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) {
    return '';
  }
  const pad = (value: number): string => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function AdminBookingQuoteForm(props: AdminBookingQuoteFormProps): ReactElement {
  const [amountPesos, setAmountPesos] = useState(centavosToPesos(props.initialQuotedAmountCentavos));
  const [expiresAtLocal, setExpiresAtLocal] = useState(toDatetimeLocalValue(props.initialQuoteExpiresAtIso));
  const [isSaving, setIsSaving] = useState(false);
  const isPending = props.status === 'pending';
  const executeSave = async (): Promise<void> => {
    setIsSaving(true);
    try {
      const pesos = Number.parseFloat(amountPesos);
      if (!Number.isFinite(pesos) || pesos <= 0) {
        throw new Error('Enter a valid quote amount in PHP.');
      }
      if (expiresAtLocal.trim().length === 0) {
        throw new Error('Quote expiry date and time are required.');
      }
      const url = buildApiUrl(`/api/admin/bookings/${encodeURIComponent(props.bookingId)}/quote`);
      const response = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quotedAmountCentavos: Math.round(pesos * 100),
          quoteExpiresAt: new Date(expiresAtLocal).toISOString(),
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(typeof payload.error === 'string' ? payload.error : 'Failed to save quote');
      }
      notifySuccess('Custom quote saved');
    } catch (error: unknown) {
      notifyError(error instanceof Error ? error.message : 'Failed to save quote');
    } finally {
      setIsSaving(false);
    }
  };
  const executeClear = async (): Promise<void> => {
    setIsSaving(true);
    try {
      const url = buildApiUrl(`/api/admin/bookings/${encodeURIComponent(props.bookingId)}/quote`);
      const response = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quotedAmountCentavos: null,
          quoteExpiresAt: null,
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(typeof payload.error === 'string' ? payload.error : 'Failed to clear quote');
      }
      setAmountPesos('');
      setExpiresAtLocal('');
      notifySuccess('Custom quote cleared');
    } catch (error: unknown) {
      notifyError(error instanceof Error ? error.message : 'Failed to clear quote');
    } finally {
      setIsSaving(false);
    }
  };
  if (!isPending) {
    return (
      <p className="text-sm text-muted-foreground">
        Custom quotes apply only to pending bookings. Catalog price for this service: {props.catalogAmountLabel}.
      </p>
    );
  }
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Catalog price for this service: <span className="font-medium text-foreground">{props.catalogAmountLabel}</span>.
        A custom quote overrides catalog and promos at checkout until expiry.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="quoteAmountPesos" className="text-sm font-medium text-foreground">
            Quote amount (PHP)
          </label>
          <Input
            id="quoteAmountPesos"
            type="number"
            min={1}
            step={0.01}
            value={amountPesos}
            onChange={(event) => {
              setAmountPesos(event.target.value);
            }}
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="quoteExpiresAt" className="text-sm font-medium text-foreground">
            Quote expires at
          </label>
          <Input
            id="quoteExpiresAt"
            type="datetime-local"
            value={expiresAtLocal}
            onChange={(event) => {
              setExpiresAtLocal(event.target.value);
            }}
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={isSaving} onClick={() => void executeSave()}>
          {isSaving ? 'Saving…' : 'Save custom quote'}
        </Button>
        <Button type="button" variant="outline" disabled={isSaving} onClick={() => void executeClear()}>
          Clear quote
        </Button>
      </div>
    </div>
  );
}
