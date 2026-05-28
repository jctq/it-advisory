'use client';

import { useState, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import type { BookingDocument } from '@/domain/types';
import { buildApiUrl } from '@/lib/config/build-api-url';
import { notifyError, notifySuccess } from '@/lib/notify';

type AdminBookingStatusFormProps = {
  readonly bookingId: string;
  readonly initialStatus: BookingDocument['status'];
  readonly paymentExpiresAtIso: string | null;
};

const STATUS_OPTIONS: readonly { readonly value: BookingDocument['status']; readonly label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

export function AdminBookingStatusForm(props: AdminBookingStatusFormProps): ReactElement {
  const router = useRouter();
  const [status, setStatus] = useState<BookingDocument['status']>(props.initialStatus);
  const [isSaving, setIsSaving] = useState(false);
  const paymentWindowLabel =
    props.paymentExpiresAtIso !== null
      ? new Date(props.paymentExpiresAtIso).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })
      : null;
  const [evaluatedAtMs] = useState(() => Date.now());
  const isPaymentWindowExpired =
    props.paymentExpiresAtIso !== null &&
    new Date(props.paymentExpiresAtIso).getTime() <= evaluatedAtMs;
  return (
    <div className="space-y-4">
      {paymentWindowLabel !== null ? (
        <p className="text-sm text-muted-foreground">
          Payment hold expires: {paymentWindowLabel}
          {isPaymentWindowExpired ? ' (expired — cron or save should mark cancelled when unpaid)' : ''}
        </p>
      ) : null}
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[12rem] space-y-2">
          <Label htmlFor="admin-booking-status">Booking status</Label>
          <NativeSelect
            id="admin-booking-status"
            value={status}
            onChange={(event) => setStatus(event.target.value as BookingDocument['status'])}
            disabled={isSaving}
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </NativeSelect>
        </div>
        <Button
          type="button"
          disabled={isSaving || status === props.initialStatus}
          onClick={() => {
            setIsSaving(true);
            void fetch(buildApiUrl(`/api/admin/bookings/${props.bookingId}/status`), {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ status }),
            })
              .then(async (response) => {
                const data = (await response.json()) as { error?: string };
                if (!response.ok) {
                  throw new Error(typeof data.error === 'string' ? data.error : 'Could not update status.');
                }
                notifySuccess('Booking status updated.');
                router.refresh();
              })
              .catch((error: unknown) => {
                notifyError(error instanceof Error ? error.message : 'Could not update status.');
              })
              .finally(() => {
                setIsSaving(false);
              });
          }}
        >
          {isSaving ? 'Saving…' : 'Save status'}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Confirmed sets payment to paid. Completed marks the session as done without changing payment. Cancelled
        expires any open checkout and frees the slot for reporting.
      </p>
    </div>
  );
}
