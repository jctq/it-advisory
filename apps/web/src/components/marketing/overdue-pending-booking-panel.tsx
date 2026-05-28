'use client';

import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react';
import { parse } from 'date-fns';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import { ChevronLeft, ChevronRight, Loader2, Trash2 } from 'lucide-react';
import {
  abandonAccountManagedBooking,
  abandonGuestManagedBooking,
  rescheduleAccountManagedBooking,
  rescheduleGuestManagedBooking,
  type GuestBookingManageCredentials,
  type GuestBookingManageView,
} from '@techmd/api-client/marketing-booking-manage-api-client';
import { getBookingAvailabilitySlots } from '@techmd/api-client/marketing-booking-api-client';
import { BookingMonthFullCalendar } from '@/components/marketing/booking-month-full-calendar';
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
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { buildAvailabilityByDateFromSlots } from '@/lib/marketing/booking-availability-by-date';
import { addManilaYearMonth } from '@/lib/marketing/manila-year-month';
import { resolveManilaMonthGridYmdBounds } from '@/lib/marketing/manila-calendar-grid-bounds';
import { PRIMARY_TIMEZONE } from '@/lib/timezone';
import { notifyError, notifySuccess } from '@/lib/notify';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type OverduePendingManageContext =
  | { readonly kind: 'account'; readonly bookingId: string }
  | { readonly kind: 'guest'; readonly credentials: GuestBookingManageCredentials };

type OverduePendingBookingPanelProps = {
  readonly booking: GuestBookingManageView;
  readonly apiBaseUrl: string;
  readonly manageContext: OverduePendingManageContext;
  readonly isSubmitting: boolean;
  readonly onSetSubmitting: (value: boolean) => void;
  readonly onBookingUpdated: (booking: GuestBookingManageView) => void;
};

export function OverduePendingBookingPanel(props: OverduePendingBookingPanelProps): ReactElement | null {
  if (!props.booking.overduePendingActionsAvailable) {
    return null;
  }
  return <OverduePendingBookingPanelBody {...props} />;
}

function OverduePendingBookingPanelBody(props: OverduePendingBookingPanelProps): ReactElement {
  const [visibleManilaYearMonth, setVisibleManilaYearMonth] = useState(() =>
    formatInTimeZone(new Date(), PRIMARY_TIMEZONE, 'yyyy-MM'),
  );
  const [availabilityByDate, setAvailabilityByDate] = useState<Record<string, readonly string[]>>({});
  const [availabilityStatus, setAvailabilityStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);
  const [selectedManilaYmd, setSelectedManilaYmd] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [slotDialogOpen, setSlotDialogOpen] = useState(false);
  const [slotDialogManilaYmd, setSlotDialogManilaYmd] = useState<string | null>(null);
  const [abandonDialogOpen, setAbandonDialogOpen] = useState(false);
  const manilaFetchBounds = useMemo(
    () => resolveManilaMonthGridYmdBounds(visibleManilaYearMonth),
    [visibleManilaYearMonth],
  );
  const monthLabel = formatInTimeZone(
    fromZonedTime(parse(`${visibleManilaYearMonth}-01 12:00`, 'yyyy-MM-dd HH:mm', new Date(0)), PRIMARY_TIMEZONE),
    PRIMARY_TIMEZONE,
    'MMMM yyyy',
  );
  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      setAvailabilityStatus('loading');
      setAvailabilityError(null);
    });
    void getBookingAvailabilitySlots({
      apiBaseUrl: props.apiBaseUrl,
      serviceKey: props.booking.serviceKey,
      fromYmd: manilaFetchBounds.from,
      toYmd: manilaFetchBounds.to,
      signal: controller.signal,
    })
      .then((slots) => {
        setAvailabilityByDate(buildAvailabilityByDateFromSlots(slots));
        setAvailabilityStatus('ready');
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === 'AbortError') {
          return;
        }
        setAvailabilityByDate({});
        setAvailabilityStatus('error');
        setAvailabilityError(error instanceof Error ? error.message : 'Failed to load times');
      });
    return () => {
      controller.abort();
    };
  }, [manilaFetchBounds.from, manilaFetchBounds.to, props.apiBaseUrl, props.booking.serviceKey]);
  const executeReschedule = useCallback(async (): Promise<void> => {
    if (selectedManilaYmd === null || selectedTime === null) {
      return;
    }
    props.onSetSubmitting(true);
    try {
      const refreshed =
        props.manageContext.kind === 'account'
          ? await rescheduleAccountManagedBooking({
              apiBaseUrl: props.apiBaseUrl,
              bookingId: props.manageContext.bookingId,
              dateYmd: selectedManilaYmd,
              timeLabel: selectedTime,
            })
          : await rescheduleGuestManagedBooking({
              apiBaseUrl: props.apiBaseUrl,
              credentials: props.manageContext.credentials,
              dateYmd: selectedManilaYmd,
              timeLabel: selectedTime,
            });
      props.onBookingUpdated(refreshed);
      notifySuccess('New session time saved. You can complete payment below.');
    } catch (error: unknown) {
      notifyError(error instanceof Error ? error.message : 'Could not reschedule.');
    } finally {
      props.onSetSubmitting(false);
    }
  }, [props, selectedManilaYmd, selectedTime]);
  const executeAbandon = useCallback(async (): Promise<void> => {
    props.onSetSubmitting(true);
    try {
      const refreshed =
        props.manageContext.kind === 'account'
          ? await abandonAccountManagedBooking({
              apiBaseUrl: props.apiBaseUrl,
              bookingId: props.manageContext.bookingId,
            })
          : await abandonGuestManagedBooking({
              apiBaseUrl: props.apiBaseUrl,
              credentials: props.manageContext.credentials,
            });
      setAbandonDialogOpen(false);
      props.onBookingUpdated(refreshed);
      notifySuccess('Booking cancelled and diagnostic removed.');
    } catch (error: unknown) {
      notifyError(error instanceof Error ? error.message : 'Could not cancel booking.');
    } finally {
      props.onSetSubmitting(false);
    }
  }, [props]);
  return (
    <div
      className={cn(
        'space-y-4 rounded-xl border border-border/60 bg-card/50 p-4 shadow-xs',
        'dark:border-border/50 dark:bg-card/35',
        'md:border-border md:bg-card md:p-6 md:shadow-sm',
      )}
    >
      <div>
        <h2 className="text-sm font-semibold text-foreground">Pick a new session time</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Your original slot has passed. Choose a future time, or delete the diagnostic to cancel this booking.
        </p>
      </div>
      <div className="rounded-xl border border-border p-4">
        <div className="flex items-center justify-between gap-4">
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Previous month"
            onClick={() => setVisibleManilaYearMonth((previous) => addManilaYearMonth(previous, -1))}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <p className="text-sm font-semibold text-foreground">{monthLabel}</p>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Next month"
            onClick={() => setVisibleManilaYearMonth((previous) => addManilaYearMonth(previous, 1))}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
        <div className="mt-4">
          <BookingMonthFullCalendar
            visibleManilaYearMonth={visibleManilaYearMonth}
            availabilityByDate={availabilityByDate}
            availabilityReady={availabilityStatus === 'ready'}
            selectedManilaYmd={selectedManilaYmd}
            pendingManilaYmd={slotDialogOpen ? slotDialogManilaYmd : null}
            onSelectDateWithSlots={(manilaYmd) => {
              setSlotDialogManilaYmd(manilaYmd);
              setSlotDialogOpen(true);
            }}
          />
        </div>
        {availabilityStatus === 'loading' ? (
          <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Loading open times…
          </p>
        ) : null}
        {availabilityStatus === 'error' ? (
          <p className="mt-3 text-sm text-destructive">{availabilityError ?? 'Could not load times.'}</p>
        ) : null}
        {selectedManilaYmd !== null && selectedTime !== null ? (
          <p className="mt-3 text-sm text-foreground">
            Selected:{' '}
            <span className="font-semibold">
              {formatInTimeZone(
                fromZonedTime(parse(`${selectedManilaYmd} 12:00`, 'yyyy-MM-dd HH:mm', new Date(0)), PRIMARY_TIMEZONE),
                PRIMARY_TIMEZONE,
                'MMM d, yyyy',
              )}{' '}
              · {selectedTime}
            </span>
          </p>
        ) : null}
        <Button
          type="button"
          className="mt-4 w-full"
          disabled={props.isSubmitting || selectedManilaYmd === null || selectedTime === null}
          onClick={() => {
            void executeReschedule();
          }}
        >
          {props.isSubmitting ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Saving new time…
            </>
          ) : (
            'Save new session time'
          )}
        </Button>
      </div>
      <Button
        type="button"
        variant="outline"
        className="w-full text-destructive hover:text-destructive"
        disabled={props.isSubmitting}
        onClick={() => setAbandonDialogOpen(true)}
      >
        <Trash2 className="size-4" aria-hidden />
        Delete diagnostic and cancel booking
      </Button>
      <Dialog
        open={slotDialogOpen}
        onOpenChange={(open) => {
          setSlotDialogOpen(open);
          if (!open) {
            setSlotDialogManilaYmd(null);
          }
        }}
      >
        <DialogContent className="gap-0 sm:max-w-md" showCloseButton>
          <DialogHeader className="space-y-2 pb-2">
            <DialogTitle>Choose a time</DialogTitle>
            <DialogDescription>
              {slotDialogManilaYmd !== null
                ? formatInTimeZone(
                    fromZonedTime(
                      parse(`${slotDialogManilaYmd} 12:00`, 'yyyy-MM-dd HH:mm', new Date(0)),
                      PRIMARY_TIMEZONE,
                    ),
                    PRIMARY_TIMEZONE,
                    'EEEE, MMMM d, yyyy',
                  )
                : PRIMARY_TIMEZONE}
            </DialogDescription>
          </DialogHeader>
          {slotDialogManilaYmd !== null && availabilityStatus === 'ready' ? (
            <ul className="max-h-[min(50vh,22rem)] space-y-2 overflow-y-auto py-1 pr-1">
              {(availabilityByDate[slotDialogManilaYmd] ?? []).map((slot) => (
                <li key={slot}>
                  <button
                    type="button"
                    className="min-h-11 w-full rounded-xl border border-border px-3 py-2.5 text-left text-sm font-medium transition-colors hover:border-primary/40 hover:bg-muted/50"
                    onClick={() => {
                      setSelectedManilaYmd(slotDialogManilaYmd);
                      setSelectedTime(slot);
                      setSlotDialogOpen(false);
                      setSlotDialogManilaYmd(null);
                    }}
                  >
                    {slot}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </DialogContent>
      </Dialog>
      <AlertDialog open={abandonDialogOpen} onOpenChange={setAbandonDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete diagnostic and cancel booking?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes your diagnostic answers and cancels the unpaid booking. You can start a new
              diagnostic anytime.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={props.isSubmitting}>Keep booking</AlertDialogCancel>
            <AlertDialogAction
              className={cn(buttonVariants(), 'bg-destructive text-white hover:bg-destructive/90')}
              disabled={props.isSubmitting}
              onClick={(event) => {
                event.preventDefault();
                void executeAbandon();
              }}
            >
              {props.isSubmitting ? 'Deleting…' : 'Delete and cancel'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
