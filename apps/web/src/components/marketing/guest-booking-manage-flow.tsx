'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, type FormEvent, type ReactElement, type ReactNode } from 'react';
import { useMarketingGuestBooking } from '@/hooks/marketing/use-marketing-guest-booking';
import type { GuestBookingManagePhase } from '@/store/marketing/marketing-guest-booking-store';
import { formatInTimeZone } from 'date-fns-tz';
import { AlertCircle, CalendarClock, CheckCircle2, CreditCard, Loader2, Search, Video } from 'lucide-react';
import {
  createAccountBookingManageCheckout,
  createGuestBookingManageCheckout,
  lookupAccountManagedBooking,
  lookupGuestBooking,
  syncAccountProfileToManagedBooking,
  type BookingPayGuidance,
  type GuestBookingManageCredentials,
  type GuestBookingManageView,
} from '@techmd/api-client/marketing-booking-manage-api-client';
import { buildPaymentGatewaysUnavailableGuidance } from '@/lib/payments/booking-pay-guidance';
import { PROJECT_RESCUE_SERVICE_TITLE } from '@techmd/diagnostic-core/project-rescue-service-context';
import {
  fetchPaymentConfigPublic,
  type PaymentConfigPublic,
} from '@techmd/api-client/marketing-payment-api-client';
import type { PaymentGatewayId } from '@/domain/payment-types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { buildApiUrl } from '@/lib/config/build-api-url';
import { AddToCalendarButtons } from '@/components/marketing/add-to-calendar-buttons';
import {
  OverduePendingBookingPanel,
  type OverduePendingManageContext,
} from '@/components/marketing/overdue-pending-booking-panel';
import { notifyError, notifySuccess } from '@/lib/notify';
import { cn } from '@/lib/utils';

function resolveMarketingClientApiBaseUrl(): string {
  const configured = buildApiUrl('/api/checkout/payment-config');
  if (configured.startsWith('http://') || configured.startsWith('https://')) {
    return new URL(configured).origin;
  }
  return '';
}

const MARKETING_CLIENT_API_BASE_URL = resolveMarketingClientApiBaseUrl();

const MONGO_OBJECT_ID_HEX = /^[a-f0-9]{24}$/i;

const MOBILE_STICKY_HEADER_TOP_CLASS = 'top-14';

const manageBookingCardClass = cn(
  'rounded-xl border border-border/60 bg-card/50 shadow-xs',
  'dark:border-border/50 dark:bg-card/35',
  'md:border-border md:bg-card md:shadow-sm',
);

function formatSlotDisplay(startsAtIso: string, timezone: string): { readonly date: string; readonly time: string } {
  const startsAt = new Date(startsAtIso);
  return {
    date: formatInTimeZone(startsAt, timezone, 'EEEE, MMMM d, yyyy'),
    time: formatInTimeZone(startsAt, timezone, 'h:mm a'),
  };
}

function StatusBadge(props: { readonly status: GuestBookingManageView['status'] }): ReactElement {
  if (props.status === 'confirmed') {
    return (
      <Badge className="bg-emerald-600/15 text-emerald-800 hover:bg-emerald-600/15 dark:text-emerald-200">Confirmed</Badge>
    );
  }
  if (props.status === 'cancelled') {
    return <Badge variant="outline">Cancelled</Badge>;
  }
  return (
    <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-100">
      Pending payment
    </Badge>
  );
}

type ManageBookingShellProps = {
  readonly mobileSubtitle: string | null;
  readonly children: ReactNode;
  readonly wide?: boolean;
};

function ManageBookingShell(props: ManageBookingShellProps): ReactElement {
  return (
    <div className="md:mx-auto">
      <div
        className={cn(
          'sticky z-40 border-b border-border/80 bg-background/95 px-4 py-3 backdrop-blur md:hidden supports-backdrop-filter:bg-background/80',
          MOBILE_STICKY_HEADER_TOP_CLASS,
        )}
      >
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Manage your booking</h1>
        {props.mobileSubtitle !== null ? (
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{props.mobileSubtitle}</p>
        ) : null}
      </div>
      <div className="px-4 pb-10 pt-4 md:px-0 md:pb-0 md:pt-0">{props.children}</div>
    </div>
  );
}

export function GuestBookingManageFlow(): ReactElement {
  const searchParams = useSearchParams();
  const {
    phase,
    bookingReference,
    email,
    phoneLastFour,
    manageContext,
    booking,
    paymentConfig,
    selectedGatewayId,
    selectedPaymentMethodId,
    isSubmitting,
    isAccountBootstrapLoading,
    setPhase,
    setBookingReference,
    setEmail,
    setPhoneLastFour,
    setManageContext,
    setBooking,
    setPaymentConfig,
    setSelectedGatewayId,
    setSelectedPaymentMethodId,
    setIsSubmitting,
    setIsAccountBootstrapLoading,
  } = useMarketingGuestBooking();
  const paymentCancelled = searchParams.get('payment') === 'cancelled';
  const hasAppliedBookingReferenceQueryRef = useRef(false);
  const hasAttemptedAccountBookingBootstrapRef = useRef(false);
  useEffect(() => {
    if (hasAppliedBookingReferenceQueryRef.current) {
      return;
    }
    const fromQuery = searchParams.get('bookingReference')?.trim();
    if (fromQuery !== undefined && fromQuery.length > 0) {
      hasAppliedBookingReferenceQueryRef.current = true;
      queueMicrotask(() => {
        setBookingReference(fromQuery);
      });
    }
  }, [searchParams, setBookingReference]);
  useEffect(() => {
    if (hasAttemptedAccountBookingBootstrapRef.current) {
      return;
    }
    const bookingIdFromQuery = searchParams.get('bookingId')?.trim() ?? '';
    if (!MONGO_OBJECT_ID_HEX.test(bookingIdFromQuery)) {
      return;
    }
    hasAttemptedAccountBookingBootstrapRef.current = true;
    queueMicrotask(() => {
      setIsAccountBootstrapLoading(true);
    });
    void lookupAccountManagedBooking({
      apiBaseUrl: MARKETING_CLIENT_API_BASE_URL,
      bookingId: bookingIdFromQuery,
    })
      .then((result) => {
        setManageContext({ kind: 'account', bookingId: bookingIdFromQuery });
        setBooking(result);
        setPhase('result');
      })
      .catch((error: unknown) => {
        notifyError(error instanceof Error ? error.message : 'Booking lookup failed.');
      })
      .finally(() => {
        setIsAccountBootstrapLoading(false);
      });
  }, [
    searchParams,
    setBooking,
    setIsAccountBootstrapLoading,
    setManageContext,
    setPhase,
  ]);
  useEffect(() => {
    const controller = new AbortController();
    void fetchPaymentConfigPublic({ apiBaseUrl: MARKETING_CLIENT_API_BASE_URL, signal: controller.signal })
      .then((config) => {
        if (!controller.signal.aborted) {
          setPaymentConfig(config);
          if (config.gateways.length > 0) {
            const firstGateway = config.gateways[0]!;
            setSelectedGatewayId(firstGateway.id);
            setSelectedPaymentMethodId(firstGateway.methods[0]?.id ?? null);
          }
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setPaymentConfig(null);
        }
      });
    return () => {
      controller.abort();
    };
  }, [setPaymentConfig, setSelectedGatewayId, setSelectedPaymentMethodId]);
  const selectedGateway = useMemo(() => {
    if (paymentConfig === null || selectedGatewayId === null) {
      return null;
    }
    return paymentConfig.gateways.find((gateway) => gateway.id === selectedGatewayId) ?? null;
  }, [paymentConfig, selectedGatewayId]);
  const availablePaymentMethods = selectedGateway?.methods ?? [];
  const executeLookup = useCallback(
    async (event: FormEvent<HTMLFormElement>): Promise<void> => {
      event.preventDefault();
      setIsSubmitting(true);
      const nextCredentials: GuestBookingManageCredentials = {
        bookingReference: bookingReference.trim(),
        email: email.trim(),
        phoneLastFour: phoneLastFour.trim(),
      };
      try {
        const result = await lookupGuestBooking({
          apiBaseUrl: MARKETING_CLIENT_API_BASE_URL,
          credentials: nextCredentials,
        });
        setManageContext({ kind: 'guest', credentials: nextCredentials });
        setBooking(result);
        setPhase('result');
      } catch (error: unknown) {
        notifyError(error instanceof Error ? error.message : 'Lookup failed.');
      } finally {
        setIsSubmitting(false);
      }
    },
    [bookingReference, email, phoneLastFour, setBooking, setIsSubmitting, setManageContext, setPhase],
  );
  const executeSyncProfile = useCallback(async (): Promise<void> => {
    if (manageContext === null || manageContext.kind !== 'account' || booking === null) {
      return;
    }
    setIsSubmitting(true);
    try {
      const refreshed = await syncAccountProfileToManagedBooking({
        apiBaseUrl: MARKETING_CLIENT_API_BASE_URL,
        bookingId: manageContext.bookingId,
      });
      setBooking(refreshed);
      if (refreshed.canPayOnline) {
        notifySuccess('Profile synced. You can complete payment below.');
      } else {
        notifySuccess('Profile synced to this booking.');
      }
    } catch (error: unknown) {
      notifyError(error instanceof Error ? error.message : 'Profile sync failed.');
    } finally {
      setIsSubmitting(false);
    }
  }, [booking, manageContext, setBooking, setIsSubmitting]);
  const executePay = useCallback(async (): Promise<void> => {
    if (manageContext === null || booking === null || selectedGatewayId === null || selectedPaymentMethodId === null) {
      return;
    }
    setIsSubmitting(true);
    setPhase('paying');
    try {
      const result =
        manageContext.kind === 'guest'
          ? await createGuestBookingManageCheckout({
              apiBaseUrl: MARKETING_CLIENT_API_BASE_URL,
              appBaseUrl: MARKETING_CLIENT_API_BASE_URL.length > 0 ? MARKETING_CLIENT_API_BASE_URL : undefined,
              credentials: manageContext.credentials,
              gatewayId: selectedGatewayId,
              paymentMethodId: selectedPaymentMethodId,
              paymentMethodLabel: selectedGateway?.methods.find((method) => method.id === selectedPaymentMethodId)?.label,
            })
          : await createAccountBookingManageCheckout({
              apiBaseUrl: MARKETING_CLIENT_API_BASE_URL,
              appBaseUrl: MARKETING_CLIENT_API_BASE_URL.length > 0 ? MARKETING_CLIENT_API_BASE_URL : undefined,
              bookingId: manageContext.bookingId,
              gatewayId: selectedGatewayId,
              paymentMethodId: selectedPaymentMethodId,
              paymentMethodLabel: selectedGateway?.methods.find((method) => method.id === selectedPaymentMethodId)?.label,
            });
      if (result.redirectUrl !== null && result.redirectUrl.length > 0) {
        window.location.assign(result.redirectUrl);
        return;
      }
      if (result.mock === true) {
        window.location.assign(
          `/book/payment/return?transactionId=${encodeURIComponent(result.transactionId)}&mock=1`,
        );
        return;
      }
      notifyError('Payment could not be started. Try again or contact support.');
      setPhase('result');
    } catch (error: unknown) {
      notifyError(error instanceof Error ? error.message : 'Payment failed.');
      setPhase('result');
    } finally {
      setIsSubmitting(false);
    }
  }, [booking, manageContext, selectedGateway, selectedGatewayId, selectedPaymentMethodId, setIsSubmitting, setPhase]);
  const resetLookup = (): void => {
    setPhase('lookup');
    setBooking(null);
    setManageContext(null);
  };
  if (isAccountBootstrapLoading) {
    return (
      <ManageBookingShell mobileSubtitle="Opening your booking from your account…">
        <div
          className={cn(manageBookingCardClass, 'flex flex-col items-center justify-center gap-4 px-6 py-14 md:px-8 md:py-16')}
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <Loader2 className="size-8 animate-spin text-primary" aria-hidden />
          <p className="text-center text-sm font-medium text-foreground">Opening your booking…</p>
          <p className="text-center text-xs leading-relaxed text-muted-foreground">
            Signed-in lookup — no need to re-enter email or phone.
          </p>
        </div>
      </ManageBookingShell>
    );
  }
  if (phase === 'lookup' || booking === null || manageContext === null) {
    return (
      <LookupForm
        bookingReference={bookingReference}
        email={email}
        phoneLastFour={phoneLastFour}
        paymentCancelled={paymentCancelled}
        isSubmitting={isSubmitting}
        onBookingReferenceChange={setBookingReference}
        onEmailChange={setEmail}
        onPhoneLastFourChange={setPhoneLastFour}
        onSubmit={executeLookup}
      />
    );
  }
  const slotDisplay = formatSlotDisplay(booking.startsAtIso, booking.timezone);
  const hasPaymentGateways = paymentConfig !== null && paymentConfig.gateways.length > 0;
  const showPaymentSection = booking.canPayOnline && hasPaymentGateways;
  const payGuidance: BookingPayGuidance | null =
    booking.payGuidance ??
    (booking.canPayOnline && !hasPaymentGateways ? buildPaymentGatewaysUnavailableGuidance() : null);
  const overdueManageContext: OverduePendingManageContext =
    manageContext.kind === 'account'
      ? { kind: 'account', bookingId: manageContext.bookingId }
      : { kind: 'guest', credentials: manageContext.credentials };
  return (
    <ResultView
      booking={booking}
      payGuidance={payGuidance}
      slotDisplay={slotDisplay}
      isSubmitting={isSubmitting}
      phase={phase}
      apiBaseUrl={MARKETING_CLIENT_API_BASE_URL}
      overdueManageContext={overdueManageContext}
      onBookingUpdated={setBooking}
      onSetSubmitting={setIsSubmitting}
      showPaymentSection={showPaymentSection}
      paymentConfig={paymentConfig}
      selectedGatewayId={selectedGatewayId}
      selectedPaymentMethodId={selectedPaymentMethodId}
      availablePaymentMethods={availablePaymentMethods}
      selectedGateway={selectedGateway}
      onResetLookup={resetLookup}
      onSyncProfile={
        booking.profileSyncAvailable && manageContext.kind === 'account'
          ? () => {
              void executeSyncProfile();
            }
          : undefined
      }
      onGatewayChange={(gatewayId, methodId) => {
        setSelectedGatewayId(gatewayId);
        setSelectedPaymentMethodId(methodId);
      }}
      onPaymentMethodChange={setSelectedPaymentMethodId}
      onPay={() => {
        void executePay();
      }}
    />
  );
}

type LookupFormProps = {
  readonly bookingReference: string;
  readonly email: string;
  readonly phoneLastFour: string;
  readonly paymentCancelled: boolean;
  readonly isSubmitting: boolean;
  readonly onBookingReferenceChange: (value: string) => void;
  readonly onEmailChange: (value: string) => void;
  readonly onPhoneLastFourChange: (value: string) => void;
  readonly onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

function LookupForm(props: LookupFormProps): ReactElement {
  return (
    <ManageBookingShell mobileSubtitle="Check status or complete payment using your booking reference.">
      {props.paymentCancelled ? (
        <div
          className="mb-4 flex gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-200"
          role="status"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>Payment was cancelled. You can try again below when your booking is still pending.</p>
        </div>
      ) : null}
      <p className="mb-4 text-sm leading-relaxed text-muted-foreground md:mb-6">
        Enter the booking reference from your confirmation email, the email you used when booking, and the last four
        digits of your phone number.
      </p>
      <form className={cn(manageBookingCardClass, 'space-y-5 p-4 md:p-6')} onSubmit={props.onSubmit} noValidate>
        <ManageField
          id="manage-booking-reference"
          label="Booking reference"
          value={props.bookingReference}
          onChange={props.onBookingReferenceChange}
          placeholder="e.g. A1B2C3D4"
          autoComplete="off"
          className="font-mono uppercase tracking-wider"
        />
        <ManageField
          id="manage-booking-email"
          label="Email"
          type="email"
          value={props.email}
          onChange={props.onEmailChange}
          placeholder="you@company.com"
          autoComplete="email"
        />
        <ManageField
          id="manage-booking-phone-last-four"
          label="Phone (last 4 digits)"
          helperText="Use the same mobile number you entered when booking."
          value={props.phoneLastFour}
          onChange={(value) => props.onPhoneLastFourChange(value.replace(/\D/g, '').slice(0, 4))}
          placeholder="6789"
          inputMode="numeric"
          autoComplete="tel-national"
          maxLength={4}
          className="font-mono tracking-widest"
        />
        <Button type="submit" size="lg" className="w-full gap-2" disabled={props.isSubmitting}>
          {props.isSubmitting ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Search className="size-4" aria-hidden />
          )}
          Find my booking
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Need a new slot?{' '}
        <Link href="/book" className="font-medium text-primary underline-offset-4 hover:underline">
          Book a consultation
        </Link>
      </p>
    </ManageBookingShell>
  );
}

type ManageFieldProps = {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly placeholder?: string;
  readonly helperText?: string;
  readonly type?: string;
  readonly autoComplete?: string;
  readonly inputMode?: 'text' | 'email' | 'numeric';
  readonly maxLength?: number;
  readonly className?: string;
};

function PayGuidanceCard(props: {
  readonly guidance: BookingPayGuidance;
  readonly isSubmitting: boolean;
  readonly onSyncProfile?: () => void;
}): ReactElement {
  return (
    <div
      className="space-y-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-4 text-sm text-amber-950 dark:text-amber-100"
      role="status"
    >
      <div className="flex gap-2">
        <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
        <div className="min-w-0 space-y-1">
          <p className="font-semibold text-amber-950 dark:text-amber-50">{props.guidance.title}</p>
          <p className="text-amber-900/90 dark:text-amber-100/90">{props.guidance.message}</p>
        </div>
      </div>
      {props.guidance.steps.length > 0 ? (
        <ol className="list-decimal space-y-1.5 pl-8 text-amber-900/90 dark:text-amber-100/90">
          {props.guidance.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      ) : null}
      <div className="flex flex-wrap gap-2 pt-1">
        {props.onSyncProfile !== undefined ? (
          <Button
            type="button"
            size="sm"
            className="bg-amber-800 text-amber-50 hover:bg-amber-900 dark:bg-amber-200 dark:text-amber-950 dark:hover:bg-amber-100"
            disabled={props.isSubmitting}
            onClick={props.onSyncProfile}
          >
            {props.isSubmitting ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Syncing…
              </>
            ) : (
              'Sync profile to booking'
            )}
          </Button>
        ) : null}
        {props.guidance.actions.map((action) => (
          <Button key={`${action.href}-${action.label}`} asChild size="sm" variant="outline" className="border-amber-600/40 bg-background/80">
            <Link href={action.href}>{action.label}</Link>
          </Button>
        ))}
      </div>
    </div>
  );
}

function ManageField(props: ManageFieldProps): ReactElement {
  return (
    <div className="space-y-2">
      <label htmlFor={props.id} className="text-sm font-medium text-foreground">
        {props.label}
      </label>
      {props.helperText !== undefined ? <p className="text-xs text-muted-foreground">{props.helperText}</p> : null}
      <Input
        id={props.id}
        name={props.id}
        type={props.type ?? 'text'}
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        placeholder={props.placeholder}
        autoComplete={props.autoComplete}
        inputMode={props.inputMode}
        maxLength={props.maxLength}
        className={cn('min-h-11', props.className)}
        required
      />
    </div>
  );
}

type ResultViewProps = {
  readonly booking: GuestBookingManageView;
  readonly payGuidance: BookingPayGuidance | null;
  readonly slotDisplay: { readonly date: string; readonly time: string };
  readonly isSubmitting: boolean;
  readonly phase: GuestBookingManagePhase;
  readonly apiBaseUrl: string;
  readonly overdueManageContext: OverduePendingManageContext;
  readonly onBookingUpdated: (booking: GuestBookingManageView) => void;
  readonly onSetSubmitting: (value: boolean) => void;
  readonly showPaymentSection: boolean;
  readonly paymentConfig: PaymentConfigPublic | null;
  readonly selectedGatewayId: PaymentGatewayId | null;
  readonly selectedPaymentMethodId: string | null;
  readonly availablePaymentMethods: PaymentConfigPublic['gateways'][number]['methods'];
  readonly selectedGateway: PaymentConfigPublic['gateways'][number] | null;
  readonly onResetLookup: () => void;
  readonly onSyncProfile?: () => void;
  readonly onGatewayChange: (gatewayId: PaymentGatewayId, methodId: string) => void;
  readonly onPaymentMethodChange: (methodId: string) => void;
  readonly onPay: () => void;
};

function ResultView(props: ResultViewProps): ReactElement {
  const hasMultipleGateways = (props.paymentConfig?.gateways.length ?? 0) > 1;
  const bookingTitle =
    props.booking.serviceKey === 'project-rescue' ? PROJECT_RESCUE_SERVICE_TITLE : props.booking.serviceKey;
  const manageBase = typeof window !== 'undefined' ? window.location.origin : '';
  const calendarDescription =
    manageBase.length > 0
      ? `Booking reference ${props.booking.bookingReference}. Manage: ${manageBase}/book/manage`
      : `Booking reference ${props.booking.bookingReference}.`;
  const mobileSubtitle =
    props.booking.status === 'confirmed'
      ? 'Your consultation is confirmed.'
      : props.booking.status === 'cancelled'
        ? 'This booking has been cancelled.'
        : 'Complete payment to confirm your session.';
  const paymentSection = props.showPaymentSection ? (
    <section
      className={cn(manageBookingCardClass, 'space-y-5 p-4 md:p-6')}
      aria-labelledby="manage-booking-payment-heading"
    >
      <div>
        <h2 id="manage-booking-payment-heading" className="text-sm font-semibold text-foreground">
          Complete payment
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Amount due:{' '}
          <span className="font-medium tabular-nums text-foreground">{props.booking.checkoutAmountLabel}</span>
        </p>
      </div>
      {hasMultipleGateways && props.paymentConfig !== null ? (
        <fieldset>
          <legend className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Payment gateway</legend>
          <div className="mt-3 space-y-2">
            {props.paymentConfig.gateways.map((gateway) => (
              <label
                key={gateway.id}
                className={cn(
                  'flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border px-3 py-3 transition-colors',
                  props.selectedGatewayId === gateway.id
                    ? 'border-primary ring-2 ring-primary/25'
                    : 'border-border hover:border-primary/30',
                )}
              >
                <input
                  type="radio"
                  name="manage-payment-gateway"
                  checked={props.selectedGatewayId === gateway.id}
                  onChange={() => props.onGatewayChange(gateway.id, gateway.methods[0]?.id ?? '')}
                  className="size-4 accent-primary"
                />
                <span className="text-sm font-medium text-foreground">{gateway.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}
      {props.availablePaymentMethods.length > 1 ? (
        <fieldset>
          <legend className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Payment method</legend>
          <div className="mt-3 space-y-2">
            {props.availablePaymentMethods.map((method) => (
              <label
                key={method.id}
                className={cn(
                  'flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border px-3 py-3 transition-colors',
                  props.selectedPaymentMethodId === method.id
                    ? 'border-primary ring-2 ring-primary/25'
                    : 'border-border hover:border-primary/30',
                )}
              >
                <input
                  type="radio"
                  name="manage-payment-method"
                  checked={props.selectedPaymentMethodId === method.id}
                  onChange={() => props.onPaymentMethodChange(method.id)}
                  className="size-4 accent-primary"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">{method.label}</p>
                  <p className="text-xs text-muted-foreground">{method.hint}</p>
                </div>
                {method.id === 'card' ? <CreditCard className="size-5 shrink-0 text-muted-foreground" aria-hidden /> : null}
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}
      <Button
        type="button"
        size="lg"
        className="w-full"
        disabled={props.isSubmitting || props.selectedPaymentMethodId === null}
        onClick={props.onPay}
      >
        {props.isSubmitting || props.phase === 'paying' ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Redirecting to payment…
          </>
        ) : (
          `Pay ${props.booking.checkoutAmountLabel}`
        )}
      </Button>
    </section>
  ) : null;
  return (
    <ManageBookingShell mobileSubtitle={mobileSubtitle} wide={props.showPaymentSection}>
      <div
        className={cn(
          'grid gap-4 md:gap-6',
          props.showPaymentSection && 'lg:grid-cols-[minmax(0,1fr)_minmax(17.5rem,22rem)] lg:items-start',
        )}
      >
        <div className="min-w-0 space-y-4 md:space-y-6">
        <section className={cn(manageBookingCardClass, 'space-y-4 p-4 md:p-6')} aria-labelledby="manage-booking-summary-heading">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Booking reference</p>
              <p
                id="manage-booking-summary-heading"
                className="mt-1 font-mono text-lg font-semibold tracking-wider text-foreground"
              >
                {props.booking.bookingReference}
              </p>
              <p className="mt-2 text-sm font-medium text-foreground">{bookingTitle}</p>
            </div>
            <StatusBadge status={props.booking.status} />
          </div>
          {props.booking.status === 'confirmed' ? (
            <div className="flex gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-300">
              <CheckCircle2 className="size-4 shrink-0" aria-hidden />
              <div className="min-w-0 space-y-2">
                <p>Your booking is confirmed. Check your email for meeting details.</p>
                {props.booking.meetingUrl !== null ? (
                  <p className="flex flex-wrap items-center gap-2">
                    <Video className="size-4 shrink-0" aria-hidden />
                    <a
                      href={props.booking.meetingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-emerald-900 underline-offset-4 hover:underline dark:text-emerald-200"
                    >
                      Join video meeting
                    </a>
                  </p>
                ) : null}
                {props.booking.fathomNotesUrl !== null ? (
                  <p>
                    <a
                      href={props.booking.fathomNotesUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-emerald-900 underline-offset-4 hover:underline dark:text-emerald-200"
                    >
                      View meeting notes
                    </a>
                  </p>
                ) : null}
                {props.booking.fathomSummaryPreview !== null ? (
                  <p className="text-xs text-emerald-900/90 dark:text-emerald-200/90">{props.booking.fathomSummaryPreview}</p>
                ) : null}
              </div>
            </div>
          ) : null}
          {props.payGuidance !== null ? (
            <PayGuidanceCard
              guidance={props.payGuidance}
              isSubmitting={props.isSubmitting}
              onSyncProfile={props.onSyncProfile}
            />
          ) : null}
        </section>
        <section className={cn(manageBookingCardClass, 'p-4 md:p-6')} aria-labelledby="manage-booking-details-heading">
          <h2 id="manage-booking-details-heading" className="text-sm font-semibold text-foreground">
            Session details
          </h2>
          <dl className="mt-4 space-y-4 text-sm">
            <div className="flex gap-3">
              <CalendarClock className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
              <div className="min-w-0">
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Scheduled session</dt>
                <dd className="mt-1 font-medium text-foreground">{props.slotDisplay.date}</dd>
                <dd className="font-medium text-foreground">{props.slotDisplay.time}</dd>
                <dd className="mt-0.5 text-xs text-muted-foreground">{props.booking.timezone}</dd>
              </div>
            </div>
            {props.booking.status === 'confirmed' ? (
              <div>
                <dt className="sr-only">Add to calendar</dt>
                <dd>
                  <AddToCalendarButtons
                    startsAtIso={props.booking.startsAtIso}
                    title={bookingTitle}
                    description={calendarDescription}
                    location={props.booking.meetingUrl ?? undefined}
                    icsUidSeed={props.booking.bookingReference}
                  />
                </dd>
              </div>
            ) : null}
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Name</dt>
              <dd className="mt-1 font-medium text-foreground">{props.booking.customerName}</dd>
            </div>
            {props.booking.paymentExpiresAtIso !== null ? (
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Pay before</dt>
                <dd className="mt-1 font-medium tabular-nums text-foreground">
                  {formatInTimeZone(
                    new Date(props.booking.paymentExpiresAtIso),
                    props.booking.timezone,
                    'MMM d, yyyy · h:mm a',
                  )}
                </dd>
              </div>
            ) : null}
          </dl>
        </section>
        <OverduePendingBookingPanel
          booking={props.booking}
          apiBaseUrl={props.apiBaseUrl}
          manageContext={props.overdueManageContext}
          isSubmitting={props.isSubmitting}
          onSetSubmitting={props.onSetSubmitting}
          onBookingUpdated={props.onBookingUpdated}
        />
        </div>
        {paymentSection !== null ? (
          <aside className="min-w-0 lg:sticky lg:top-24 lg:self-start">{paymentSection}</aside>
        ) : null}
      </div>
      <Button type="button" variant="outline" className="mt-4 w-full md:mt-6" onClick={props.onResetLookup}>
        Look up a different booking
      </Button>
    </ManageBookingShell>
  );
}
