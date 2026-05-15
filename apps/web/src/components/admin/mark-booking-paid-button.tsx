'use client';

import { useState, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { buildApiUrl } from '@/lib/config/build-api-url';

type MarkBookingPaidButtonProps = {
  readonly bookingId: string;
  readonly status: string;
};

export function MarkBookingPaidButton(props: MarkBookingPaidButtonProps): ReactElement | null {
  const { bookingId, status } = props;
  const router = useRouter();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  if (status !== 'pending') {
    return null;
  }
  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        disabled={isLoading}
        onClick={() => {
          setIsLoading(true);
          setErrorMessage(null);
          void fetch(buildApiUrl(`/api/admin/bookings/${bookingId}/mark-paid`), { method: 'POST' })
            .then(async (response) => {
              const data = (await response.json()) as { error?: string };
              if (!response.ok) {
                throw new Error(typeof data.error === 'string' ? data.error : 'Could not mark as paid.');
              }
              router.refresh();
            })
            .catch((error: unknown) => {
              setErrorMessage(error instanceof Error ? error.message : 'Could not mark as paid.');
            })
            .finally(() => {
              setIsLoading(false);
            });
        }}
      >
        {isLoading ? 'Updating…' : 'Mark as paid'}
      </Button>
      {errorMessage !== null ? <p className="text-sm text-destructive">{errorMessage}</p> : null}
    </div>
  );
}
