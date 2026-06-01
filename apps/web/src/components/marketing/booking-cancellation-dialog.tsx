'use client';

import { useCallback, useState, type FormEvent, type ReactElement } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { BookingCustomerActionMode } from '@/lib/booking/booking-customer-action-eligibility';
import { BOOKING_CANCELLATION_MIN_HOURS_BEFORE } from '@/lib/booking/booking-cancellation-policy';

export type BookingCancellationDialogProps = {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly mode: BookingCustomerActionMode;
  readonly isCompletedBooking?: boolean;
  readonly expectedReference?: string | null;
  readonly isSubmitting?: boolean;
  readonly onConfirm: (referenceInput: string) => Promise<void>;
};

function resolveDialogCopy(input: {
  readonly mode: BookingCustomerActionMode;
  readonly isCompletedBooking: boolean;
}): {
  readonly title: string;
  readonly description: string;
  readonly confirmLabel: string;
  readonly submittingLabel: string;
  readonly dismissLabel: string;
} {
  if (input.mode === 'cancel') {
    return {
      title: 'Cancel booking',
      description: `Cancellations are only allowed at least ${BOOKING_CANCELLATION_MIN_HOURS_BEFORE} hours before your scheduled date and time. Enter your booking reference to confirm you want to cancel this booking.`,
      confirmLabel: 'Confirm cancellation',
      submittingLabel: 'Cancelling…',
      dismissLabel: 'Keep booking',
    };
  }
  if (input.isCompletedBooking) {
    return {
      title: 'Request refund',
      description:
        'Enter your booking reference to confirm you want to request a refund for this completed session. We will process your refund manually and email you when it is complete.',
      confirmLabel: 'Confirm refund request',
      submittingLabel: 'Submitting…',
      dismissLabel: 'Keep booking',
    };
  }
  return {
    title: 'Request refund',
    description: `Refund requests are only allowed at least ${BOOKING_CANCELLATION_MIN_HOURS_BEFORE} hours before your scheduled date and time. Enter your booking reference to confirm you want to request a refund. We will process your refund manually and email you when it is complete.`,
    confirmLabel: 'Confirm refund request',
    submittingLabel: 'Submitting…',
    dismissLabel: 'Keep booking',
  };
}

export function BookingCancellationDialog(props: BookingCancellationDialogProps): ReactElement {
  const { onOpenChange, onConfirm } = props;
  const [referenceInput, setReferenceInput] = useState('');
  const copy = resolveDialogCopy({
    mode: props.mode,
    isCompletedBooking: props.isCompletedBooking === true,
  });
  const handleOpenChange = useCallback(
    (open: boolean): void => {
      if (!open) {
        setReferenceInput('');
      }
      onOpenChange(open);
    },
    [onOpenChange],
  );
  const executeSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>): Promise<void> => {
      event.preventDefault();
      await onConfirm(referenceInput.trim());
    },
    [onConfirm, referenceInput],
  );
  return (
    <Dialog open={props.open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <form onSubmit={(event) => void executeSubmit(event)}>
          <DialogHeader>
            <DialogTitle>{copy.title}</DialogTitle>
            <DialogDescription>{copy.description}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="booking-cancellation-reference">Booking reference</Label>
            <Input
              id="booking-cancellation-reference"
              name="bookingReference"
              value={referenceInput}
              onChange={(event) => setReferenceInput(event.target.value)}
              placeholder={props.expectedReference ?? 'Enter reference'}
              autoComplete="off"
              minLength={4}
              maxLength={12}
              className="font-mono uppercase tracking-wider"
              required
            />
            {props.expectedReference !== null && props.expectedReference !== undefined ? (
              <p className="text-xs text-muted-foreground">
                Your reference: <span className="font-mono font-medium text-foreground">{props.expectedReference}</span>
              </p>
            ) : null}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={props.isSubmitting}>
              {copy.dismissLabel}
            </Button>
            <Button type="submit" variant="destructive" disabled={props.isSubmitting || referenceInput.trim().length < 4}>
              {props.isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  {copy.submittingLabel}
                </>
              ) : (
                copy.confirmLabel
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
