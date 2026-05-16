'use client';

import { useState, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { buildApiUrl } from '@/lib/config/build-api-url';
import { notifyError, notifySuccess } from '@/lib/notify';

type MarkBookingPaidButtonProps = {
  readonly bookingId: string;
  readonly status: string;
};

export function MarkBookingPaidButton(props: MarkBookingPaidButtonProps): ReactElement | null {
  const { bookingId, status } = props;
  const router = useRouter();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  if (status !== 'pending') {
    return null;
  }
  return (
    <Button
      type="button"
      variant="outline"
      disabled={isLoading}
      onClick={() => {
        setIsLoading(true);
        void fetch(buildApiUrl(`/api/admin/bookings/${bookingId}/mark-paid`), { method: 'POST' })
          .then(async (response) => {
            const data = (await response.json()) as { error?: string };
            if (!response.ok) {
              throw new Error(typeof data.error === 'string' ? data.error : 'Could not mark as paid.');
            }
            notifySuccess('Booking marked as paid.');
            router.refresh();
          })
          .catch((error: unknown) => {
            notifyError(error instanceof Error ? error.message : 'Could not mark as paid.');
          })
          .finally(() => {
            setIsLoading(false);
          });
      }}
    >
      {isLoading ? 'Updating…' : 'Mark as paid'}
    </Button>
  );
}
