'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactElement } from 'react';
import { formatInTimeZone } from 'date-fns-tz';
import { AlertCircle, CalendarClock, CheckCircle2, CreditCard, Loader2, Search, Video } from 'lucide-react';
import {
  createAccountBookingManageCheckout,
  createGuestBookingManageCheckout,
  lookupAccountManagedBooking,
  lookupGuestBooking,
  type GuestBookingManageCredentials,
  type GuestBookingManageView,
} from '@techmd/api-client/marketing-booking-manage-api-client';
import { PROJECT_RESCUE_SERVICE_TITLE } from '@techmd/diagnostic-core/project-rescue-service-context';
import {
  fetchPaymentConfigPublic,
  type PaymentConfigPublic,
} from '@techmd/api-client/marketing-payment-api-client';
import type { PaymentGatewayId } from '@/domain/payment-types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { buildApiUrl } from '@/lib/config/build-api-url';
import { AddToCalendarButtons } from '@/components/marketing/add-to-calendar-buttons';
import { notifyError } from '@/lib/notify';
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

type ManageAuthContext =
  | { readonly kind: 'guest'; readonly credentials: GuestBookingManageCredentials }
  | { readonly kind: 'account'; readonly bookingId: string };

type ManagePhase = 'lookup' | 'result' | 'paying';

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
      <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
        Confirmed
      </span>
    );
  }
  if (props.status === 'cancelled') {
    return (
      <span className="inline-flex items-center rounded-full bg-destructive/15 px-2.5 py-0.5 text-xs font-semibold text-destructive">
        Cancelled
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-semibold text-amber-800 dark:text-amber-300">
      Pending payment
    </span>
  );
}

export function GuestBookingManageFlow(): ReactElement {
  const searchParams = useSearchParams();
  const [phase, setPhase] = useState<ManagePhase>('lookup');
  const [bookingReference, setBookingReference] = useState('');
  const [email, setEmail] = useState('');
  const [phoneLastFour, setPhoneLastFour] = useState('');
  const [manageContext, setManageContext] = useState<ManageAuthContext | null>(null);
  const [booking, setBooking] = useState<GuestBookingManageView | null>(null);
  const [paymentConfig, setPaymentConfig] = useState<PaymentConfigPublic | null>(null);
  const [selectedGatewayId, setSelectedGatewayId] = useState<PaymentGatewayId | null>(null);
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAccountBootstrapLoading, setIsAccountBootstrapLoading] = useState(false);
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
  }, [searchParams]);
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
  }, [searchParams]);
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
  }, []);
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
    [bookingReference, email, phoneLastFour],
  );
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
  }, [booking, manageContext, selectedGateway, selectedGatewayId, selectedPaymentMethodId]);
  const resetLookup = (): void => {
    setPhase('lookup');
    setBooking(null);
    setManageContext(null);
  };
  if (isAccountBootstrapLoading) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center justify-center gap-4 rounded-2xl border border-border bg-card px-8 py-16 shadow-xs">
        <Loader2 className="size-8 animate-spin text-primary" aria-hidden />
        <p className="text-center text-sm font-medium text-foreground">Opening your booking…</p>
        <p className="text-center text-xs text-muted-foreground">Signed-in lookup — no need to re-enter email or phone.</p>
      </div>
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
  const showPaymentSection = booking.canPayOnline && paymentConfig !== null && paymentConfig.gateways.length > 0;
  return (
    <ResultView
      booking={booking}
      slotDisplay={slotDisplay}
      isSubmitting={isSubmitting}
      phase={phase}
      showPaymentSection={showPaymentSection}
      paymentConfig={paymentConfig}
      selectedGatewayId={selectedGatewayId}
      selectedPaymentMethodId={selectedPaymentMethodId}
      availablePaymentMethods={availablePaymentMethods}
      selectedGateway={selectedGateway}
      onResetLookup={resetLookup}
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
    <form className="mx-auto max-w-lg space-y-6" onSubmit={props.onSubmit} noValidate>
      {props.paymentCancelled ? (
        <div className="flex gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>Payment was cancelled. You can try again below when your booking is still pending.</p>
        </div>
      ) : null}
      <p className="text-sm text-muted-foreground">
        Enter the booking reference from your confirmation email, the email you used when booking, and the last four
        digits of your phone number.
      </p>
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
        value={props.phoneLastFour}
        onChange={(value) => props.onPhoneLastFourChange(value.replace(/\D/g, '').slice(0, 4))}
        placeholder="6789"
        inputMode="numeric"
        autoComplete="tel-national"
        maxLength={4}
        className="font-mono tracking-widest"
      />
      <Button type="submit" size="lg" className="w-full gap-2" disabled={props.isSubmitting}>
        {props.isSubmitting ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Search className="size-4" aria-hidden />}
        Find my booking
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        Need a new slot?{' '}
        <Link href="/book" className="font-medium text-primary underline-offset-4 hover:underline">
          Book a consultation
        </Link>
      </p>
    </form>
  );
}

type ManageFieldProps = {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly placeholder?: string;
  readonly type?: string;
  readonly autoComplete?: string;
  readonly inputMode?: 'text' | 'email' | 'numeric';
  readonly maxLength?: number;
  readonly className?: string;
};

function ManageField(props: ManageFieldProps): ReactElement {
  return (
    <div className="space-y-2">
      <Label htmlFor={props.id}>{props.label}</Label>
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
        className={props.className}
        required
      />
    </div>
  );
}

type ResultViewProps = {
  readonly booking: GuestBookingManageView;
  readonly slotDisplay: { readonly date: string; readonly time: string };
  readonly isSubmitting: boolean;
  readonly phase: ManagePhase;
  readonly showPaymentSection: boolean;
  readonly paymentConfig: PaymentConfigPublic | null;
  readonly selectedGatewayId: PaymentGatewayId | null;
  readonly selectedPaymentMethodId: string | null;
  readonly availablePaymentMethods: PaymentConfigPublic['gateways'][number]['methods'];
  readonly selectedGateway: PaymentConfigPublic['gateways'][number] | null;
  readonly onResetLookup: () => void;
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
  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="rounded-2xl border border-border bg-card p-6 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Booking reference</p>
            <p className="mt-1 font-mono text-lg font-semibold tracking-wider text-foreground">{props.booking.bookingReference}</p>
          </div>
          <StatusBadge status={props.booking.status} />
        </div>
        <dl className="mt-6 space-y-4">
          <div className="flex gap-3">
            <CalendarClock className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
            <div>
              <dt className="text-xs font-medium text-muted-foreground">When</dt>
              <dd className="text-sm font-semibold text-foreground">{props.slotDisplay.date}</dd>
              <dd className="text-sm font-semibold text-foreground">{props.slotDisplay.time}</dd>
              <dd className="text-xs text-muted-foreground">{props.booking.timezone}</dd>
            </div>
          </div>
          {props.booking.status === 'confirmed' ? (
            <AddToCalendarButtons
              className="mt-2 pl-8"
              startsAtIso={props.booking.startsAtIso}
              title={bookingTitle}
              description={calendarDescription}
              location={props.booking.meetingUrl ?? undefined}
              icsUidSeed={props.booking.bookingReference}
            />
          ) : null}
          <div>
            <dt className="text-xs font-medium text-muted-foreground">Name</dt>
            <dd className="text-sm font-semibold text-foreground">{props.booking.customerName}</dd>
          </div>
          {props.booking.paymentExpiresAtIso !== null ? (
            <div>
              <dt className="text-xs font-medium text-muted-foreground">Pay before</dt>
              <dd className="text-sm text-foreground">
                {formatInTimeZone(new Date(props.booking.paymentExpiresAtIso), props.booking.timezone, 'MMM d, yyyy · h:mm a')}
              </dd>
            </div>
          ) : null}
        </dl>
        {props.booking.status === 'confirmed' ? (
          <div className="mt-6 flex gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-300">
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
            </div>
          </div>
        ) : null}
        {props.booking.payBlockedReason !== null ? (
          <div className="mt-6 flex gap-2 rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
            <AlertCircle className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <p>{props.booking.payBlockedReason}</p>
          </div>
        ) : null}
      </div>
      {props.showPaymentSection ? (
        <div className="space-y-6 rounded-2xl border border-border bg-card p-6 shadow-xs">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Complete payment</h2>
            <p className="mt-1 text-xs text-muted-foreground">Amount due: {props.booking.checkoutAmountLabel}</p>
          </div>
          {hasMultipleGateways && props.paymentConfig !== null ? (
            <fieldset>
              <legend className="text-sm font-semibold text-foreground">Payment gateway</legend>
              <div className="mt-3 space-y-2">
                {props.paymentConfig.gateways.map((gateway) => (
                  <label
                    key={gateway.id}
                    className={cn(
                      'flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors',
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
          {props.availablePaymentMethods.length > 0 ? (
            <fieldset>
              <legend className="text-sm font-semibold text-foreground">Payment method</legend>
              <div className="mt-3 space-y-2">
                {props.availablePaymentMethods.map((method) => (
                  <label
                    key={method.id}
                    className={cn(
                      'flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors',
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
        </div>
      ) : null}
      <Button type="button" variant="outline" className="w-full" onClick={props.onResetLookup}>
        Look up a different booking
      </Button>
    </div>
  );
}
