'use client';

import Link from 'next/link';
import { Trash2 } from 'lucide-react';
import { useCallback, useMemo, useState, type ReactElement } from 'react';
import {
  BookingCancellationError,
  cancelAccountManagedBooking,
} from '@techmd/api-client/marketing-booking-manage-api-client';
import type { PaymentPolicy } from '@/domain/payment-types';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { VisitorDiagnosticSessionSummary } from '@/lib/data/diagnostic-session-types';
import { BookingCancellationDialog } from '@/components/marketing/booking-cancellation-dialog';
import {
  buildSessionManageHref,
  resolveAccountDiagnosticsSessionActions,
  resolveAccountDiagnosticsSessionCustomerAction,
} from '@/lib/marketing/account-diagnostics-session-actions';
import { buildMarketingDiagnosticSessionPath } from '@/lib/marketing/diagnostic-session-marketing-ref';
import { buildApiUrl } from '@/lib/config/build-api-url';
import { cn } from '@/lib/utils';
import { notifyError, notifySuccess } from '@/lib/notify';

const DIAGNOSTIC_SESSION_API_URL = '/api/diagnostic/session';

const MARKETING_CLIENT_API_BASE_URL = ((): string => {
  const configured = buildApiUrl('/api/checkout/payment-config');
  if (configured.startsWith('http://') || configured.startsWith('https://')) {
    return new URL(configured).origin;
  }
  return '';
})();

export type AccountDiagnosticsSessionActionsBarProps = {
  readonly row: VisitorDiagnosticSessionSummary;
  readonly manageBookingEnabled: boolean;
  readonly paymentPolicy: PaymentPolicy;
  readonly refundsEnabled?: boolean;
  readonly viewLabel?: string;
  readonly onCancelled?: () => void;
  readonly onDeleted?: () => void;
};

export function AccountDiagnosticsSessionActionsBar(
  props: AccountDiagnosticsSessionActionsBarProps,
): ReactElement {
  const actionOptions = useMemo(
    () => ({
      paymentPolicy: props.paymentPolicy,
      refundsEnabled: props.refundsEnabled,
    }),
    [props.paymentPolicy, props.refundsEnabled],
  );
  const actions = resolveAccountDiagnosticsSessionActions(props.row, actionOptions);
  const customerAction = resolveAccountDiagnosticsSessionCustomerAction(props.row, actionOptions);
  const viewLabel = props.viewLabel ?? 'View';
  const manageHref = buildSessionManageHref(props.row, props.manageBookingEnabled);
  const viewHref = buildMarketingDiagnosticSessionPath(props.row.marketingSessionRef);
  const deletePreview =
    props.row.situationPreview?.trim() ||
    props.row.sessionTitlePreview?.trim() ||
    null;
  const bookingId = props.row.bookingId;
  const marketingSessionRef = props.row.marketingSessionRef;
  const onCancelled = props.onCancelled;
  const onDeleted = props.onDeleted;
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const executeCancel = useCallback(
    async (referenceInput: string): Promise<void> => {
      if (bookingId === null) {
        notifyError('Booking not found.');
        return;
      }
      setIsCancelling(true);
      try {
        const result = await cancelAccountManagedBooking({
          apiBaseUrl: MARKETING_CLIENT_API_BASE_URL,
          bookingId,
          bookingReference: referenceInput,
        });
        notifySuccess(
          result.mode === 'refund'
            ? 'Refund request submitted. We will email you when it is processed.'
            : 'Booking cancelled.',
        );
        setIsCancelDialogOpen(false);
        onCancelled?.();
      } catch (error: unknown) {
        if (error instanceof BookingCancellationError) {
          notifyError(error.message);
          return;
        }
        notifyError(error instanceof Error ? error.message : 'Request failed.');
      } finally {
        setIsCancelling(false);
      }
    },
    [bookingId, onCancelled, setIsCancelDialogOpen, setIsCancelling],
  );
  const executeDelete = useCallback(async (): Promise<void> => {
    setDeleteError(null);
    setIsDeleting(true);
    try {
      const url = `${DIAGNOSTIC_SESSION_API_URL}?sessionId=${encodeURIComponent(marketingSessionRef)}`;
      const response = await fetch(url, { method: 'DELETE', credentials: 'include' });
      const payload: unknown = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message =
          typeof payload === 'object' &&
          payload !== null &&
          'error' in payload &&
          typeof (payload as { error?: unknown }).error === 'string'
            ? (payload as { error: string }).error
            : 'Delete failed.';
        setDeleteError(message);
        return;
      }
      setIsDeleteDialogOpen(false);
      notifySuccess('Diagnostic deleted.');
      onDeleted?.();
    } catch (error: unknown) {
      setDeleteError(error instanceof Error ? error.message : 'Delete failed.');
    } finally {
      setIsDeleting(false);
    }
  }, [marketingSessionRef, onDeleted, setDeleteError, setIsDeleteDialogOpen, setIsDeleting]);
  return (
    <>
      <div className="flex flex-wrap justify-end gap-2">
        {actions.includes('view') ? (
          <Button type="button" variant="outline" size="sm" asChild>
            <Link href={viewHref}>{viewLabel}</Link>
          </Button>
        ) : null}
        {actions.includes('cancel') ? (
          <Button type="button" variant="outline" size="sm" onClick={() => setIsCancelDialogOpen(true)}>
            Cancel
          </Button>
        ) : null}
        {actions.includes('refund') ? (
          <Button type="button" variant="outline" size="sm" onClick={() => setIsCancelDialogOpen(true)}>
            Refund
          </Button>
        ) : null}
        {actions.includes('delete') ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => setIsDeleteDialogOpen(true)}
          >
            Delete
          </Button>
        ) : null}
        {actions.includes('manage') ? (
          <Button type="button" variant="secondary" size="sm" asChild>
            <Link href={manageHref}>Manage</Link>
          </Button>
        ) : null}
        {actions.includes('continue') ? (
          <Button type="button" size="sm" asChild>
            <Link href={viewHref}>Continue</Link>
          </Button>
        ) : null}
      </div>
      {customerAction !== null ? (
        <BookingCancellationDialog
          open={isCancelDialogOpen}
          onOpenChange={setIsCancelDialogOpen}
          mode={customerAction}
          isCompletedBooking={props.row.bookingStatus === 'completed'}
          expectedReference={props.row.bookingReferenceId}
          isSubmitting={isCancelling}
          onConfirm={executeCancel}
        />
      ) : null}
      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={(open) => {
          if (!open && !isDeleting) {
            setIsDeleteDialogOpen(false);
            setDeleteError(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this diagnostic?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the diagnostic snapshot and cannot be undone. Any reserved consultation time
              linked to this diagnostic is cancelled so the slot can be booked by someone else.
              {deletePreview !== null ? (
                <span className="mt-2 block rounded-md border border-border bg-muted/40 px-3 py-2 text-foreground">
                  {deletePreview}
                </span>
              ) : null}
              {deleteError !== null ? (
                <span className="mt-2 block text-destructive" role="alert">
                  {deleteError}
                </span>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={cn(buttonVariants(), 'bg-destructive text-white hover:bg-destructive/90')}
              disabled={isDeleting}
              onClick={(event) => {
                event.preventDefault();
                void executeDelete();
              }}
            >
              <Trash2 className="size-4" aria-hidden />
              {isDeleting ? 'Deleting…' : 'Delete diagnostic'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
