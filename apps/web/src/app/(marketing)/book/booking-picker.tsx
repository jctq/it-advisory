'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { addMonths, parse } from 'date-fns';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Loader2,
  Lock,
  Shield,
  Video,
} from 'lucide-react';
import { fetchMarketingServerClockOffsetMs } from '@techmd/api-client/marketing-booking-api-client';
import {
  createPaymentCheckoutSession,
  fetchPaymentConfigPublic,
  fetchPaymentTransactionStatus,
  type PaymentConfigPublic,
} from '@techmd/api-client/marketing-payment-api-client';
import type { PaymentGatewayId } from '@/domain/payment-types';
import { PROJECT_RESCUE_SERVICE_TITLE, PROJECT_RESCUE_SERVICE_TAGLINE, PROJECT_RESCUE_SESSION_DURATION } from '@techmd/diagnostic-core/project-rescue-service-context';
import { BookingMonthFullCalendar } from '@/components/marketing/booking-month-full-calendar';
import { AddToCalendarButtons } from '@/components/marketing/add-to-calendar-buttons';
import { HorizontalProgressStepper } from '@/components/marketing/horizontal-progress-stepper';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { buildApiUrl } from '@/lib/config/build-api-url';
import { parseBookingSlotToUtc } from '@/lib/marketing/booking-slot';
import { resolveManilaMonthGridYmdBounds } from '@/lib/marketing/manila-calendar-grid-bounds';
import { sortBookingSlotTimesForManilaDate } from '@/lib/marketing/sort-booking-slot-times-for-manila-date';
import { PRIMARY_TIMEZONE } from '@/lib/timezone';
import { notifyError } from '@/lib/notify';
import { cn } from '@/lib/utils';
import { formatBookingReferenceId } from '@/lib/marketing/booking-reference';
import {
  buildMarketingBookSessionPath,
  buildMarketingQuizSessionPath,
  isPlausibleMarketingQuizSessionRef,
} from '@/lib/marketing/quiz-session-marketing-ref';

const BOOKINGS_API_URL = '/api/bookings';
const PAYMENT_CONFIG_API_URL = buildApiUrl('/api/checkout/payment-config');
const AVAILABILITY_API_URL = buildApiUrl('/api/booking/availability');
const AUTH_ME_API_URL = buildApiUrl('/api/auth/me');

type MarketingProfilePrefill = {
  readonly fullName: string | null;
  readonly email: string | null;
  readonly company: string | null;
  readonly phone: string | null;
};

function pickNonEmptyTrimmedString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseMarketingProfilePrefillFromAuthMePayload(payload: unknown): MarketingProfilePrefill | null {
  if (typeof payload !== 'object' || payload === null) {
    return null;
  }
  const root = payload as { readonly user?: unknown };
  const user = root.user;
  if (user === null || typeof user !== 'object') {
    return null;
  }
  const row = user as Record<string, unknown>;
  return {
    fullName: pickNonEmptyTrimmedString(row.fullName),
    email: pickNonEmptyTrimmedString(row.email),
    company: pickNonEmptyTrimmedString(row.company),
    phone: pickNonEmptyTrimmedString(row.phone),
  };
}

function resolveMarketingClientApiBaseUrl(): string {
  if (AVAILABILITY_API_URL.startsWith('http://') || AVAILABILITY_API_URL.startsWith('https://')) {
    return new URL(AVAILABILITY_API_URL).origin;
  }
  return '';
}

const MARKETING_CLIENT_API_BASE_URL = resolveMarketingClientApiBaseUrl();
const DEFAULT_SERVICE_KEY = 'project-rescue' as const;

const DEFAULT_CHECKOUT_AMOUNT_LABEL = '₱6,000.00';
type BookingSlotPhase = 'date' | 'details' | 'payment';

type BookingPhase = BookingSlotPhase | 'processing' | 'success' | 'error';

type PaymentMethodId = 'card' | 'gcash' | 'maya' | 'bank_transfer' | 'paypal';

const PAYMENT_METHOD_OPTIONS: readonly {
  readonly id: PaymentMethodId;
  readonly label: string;
  readonly hint: string;
}[] = [
  { id: 'card', label: 'Credit / Debit Card', hint: 'Visa · Mastercard · JCB' },
  { id: 'gcash', label: 'GCash', hint: 'Pay with GCash' },
  { id: 'maya', label: 'Maya', hint: 'Pay with Maya' },
  { id: 'bank_transfer', label: 'Bank transfer', hint: 'BPI · BDO · UnionBank' },
  { id: 'paypal', label: 'PayPal', hint: 'Pay with PayPal' },
];

const BOOKING_STEPS: readonly {
  readonly id: BookingSlotPhase;
  /** Uppercase label in the desktop stepper (matches quiz template progress). */
  readonly barLabel: string;
  /** Title case headline on the mobile summary row. */
  readonly headline: string;
}[] = [
  { id: 'date', barLabel: 'DATE & TIME', headline: 'Date & Time' },
  { id: 'details', barLabel: 'YOUR DETAILS', headline: 'Your details' },
  { id: 'payment', barLabel: 'PAYMENT', headline: 'Payment' },
];

function addManilaYearMonth(manilaYearMonth: string, deltaMonths: number): string {
  const pivot = fromZonedTime(
    parse(`${manilaYearMonth}-15 12:00`, 'yyyy-MM-dd HH:mm', new Date(0)),
    PRIMARY_TIMEZONE,
  );
  return formatInTimeZone(addMonths(pivot, deltaMonths), PRIMARY_TIMEZONE, 'yyyy-MM');
}

type ConfirmedSlotDisplay = {
  readonly dateLong: string;
  readonly timeLabel: string;
};

type ConfirmedCalendarSlot = {
  readonly startsAtIso: string;
  readonly timezone: string;
};

function formatConfirmedSlotFromStartsAt(startsAtIso: string, timezone: string): ConfirmedSlotDisplay {
  const startsAt = new Date(startsAtIso);
  return {
    dateLong: formatInTimeZone(startsAt, timezone, 'EEEE, MMMM d, yyyy'),
    timeLabel: formatInTimeZone(startsAt, timezone, 'h:mm a'),
  };
}

function resolveStepStatus(params: {
  readonly stepIndex: number;
  readonly activeStepIndex: number;
}): 'complete' | 'current' | 'upcoming' {
  if (params.stepIndex < params.activeStepIndex) {
    return 'complete';
  }
  if (params.stepIndex === params.activeStepIndex) {
    return 'current';
  }
  return 'upcoming';
}

function BookingStepper(props: { readonly activePhase: BookingSlotPhase }): ReactElement {
  const { activePhase } = props;
  const activeStepIndex = BOOKING_STEPS.findIndex((s) => s.id === activePhase);
  const resolvedIndex = activeStepIndex >= 0 ? activeStepIndex : 0;
  const currentStep = BOOKING_STEPS[resolvedIndex] ?? BOOKING_STEPS[0];
  const currentHeadline = currentStep?.headline ?? '';
  return (
    <>
      <div
        className="flex flex-col gap-1 lg:hidden"
        role="group"
        aria-label={`Booking checkout: step ${resolvedIndex + 1} of ${BOOKING_STEPS.length}, ${currentHeadline}`}
      >
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Step {resolvedIndex + 1} of {BOOKING_STEPS.length}
          </p>
          <p className="min-w-0 truncate text-right text-xs font-semibold text-foreground">{currentHeadline}</p>
        </div>
        <div className="flex items-center gap-1">
          {BOOKING_STEPS.map((step, stepIndex) => {
            const status = resolveStepStatus({ stepIndex, activeStepIndex: resolvedIndex });
            const barClassName = cn(
              'h-1 w-full rounded-full',
              status === 'complete' ? 'bg-primary' : status === 'current' ? 'bg-primary/60' : 'bg-muted',
            );
            return (
              <div key={step.id} className="flex min-h-9 min-w-0 flex-1 items-center px-0.5">
                <span className={barClassName} aria-hidden />
              </div>
            );
          })}
        </div>
      </div>
      <HorizontalProgressStepper
        className="rounded-2xl border border-border bg-card px-3 py-2.5 shadow-xs lg:rounded-xl"
        ariaLabel={`Booking checkout: step ${resolvedIndex + 1} of ${BOOKING_STEPS.length}, ${currentHeadline}`}
        steps={BOOKING_STEPS.map((step, index) => ({
          id: step.id,
          label: step.headline,
          status: resolveStepStatus({ stepIndex: index, activeStepIndex: resolvedIndex }),
        }))}
      />
    </>
  );
}

export type BookingPickerProps = {
  /** When set (from `/book/[sessionRef]`), attaches checkout to that diagnostic row; legacy `?sessionId=` on `/book` redirects here. */
  readonly pathSessionRef?: string | null;
  /** When false, manage-booking links are hidden (admin diagnostic setting). */
  readonly manageBookingEnabled?: boolean;
};

/**
 * Multi-step marketing checkout: slot selection, contact capture, mock payment choice, then booking persistence.
 */
export function BookingPicker(props: BookingPickerProps = {}): ReactElement {
  const { pathSessionRef, manageBookingEnabled = false } = props;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  useLayoutEffect(() => {
    const hasPathRef =
      pathSessionRef !== undefined && pathSessionRef !== null && pathSessionRef.trim().length > 0;
    if (hasPathRef) {
      return;
    }
    if (pathname !== '/book') {
      return;
    }
    const fromQuery = searchParams.get('sessionId')?.trim() ?? '';
    if (!isPlausibleMarketingQuizSessionRef(fromQuery)) {
      return;
    }
    router.replace(buildMarketingBookSessionPath(fromQuery));
  }, [pathSessionRef, pathname, router, searchParams]);
  const quizSessionRef = useMemo((): string => {
    if (pathSessionRef !== undefined && pathSessionRef !== null) {
      const trimmed = pathSessionRef.trim();
      return isPlausibleMarketingQuizSessionRef(trimmed) ? trimmed : '';
    }
    return searchParams.get('sessionId')?.trim() ?? '';
  }, [pathSessionRef, searchParams]);
  const hasValidQuizSessionParam = isPlausibleMarketingQuizSessionRef(quizSessionRef);
  const hasUserNavigatedVisibleMonthRef = useRef<boolean>(false);
  const [serverClockOffsetMs, setServerClockOffsetMs] = useState<number | null>(null);
  const [phase, setPhase] = useState<BookingPhase>('date');
  const [visibleManilaYearMonth, setVisibleManilaYearMonth] = useState<string>(() =>
    formatInTimeZone(new Date(), PRIMARY_TIMEZONE, 'yyyy-MM'),
  );
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [slotDialogOpen, setSlotDialogOpen] = useState<boolean>(false);
  const [slotDialogManilaYmd, setSlotDialogManilaYmd] = useState<string | null>(null);
  const [fullName, setFullName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [company, setCompany] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodId | null>('card');
  const [paymentConfig, setPaymentConfig] = useState<PaymentConfigPublic | null>(null);
  const [selectedGatewayId, setSelectedGatewayId] = useState<PaymentGatewayId | null>(null);
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState<string | null>(null);
  const [availabilityByDate, setAvailabilityByDate] = useState<Record<string, readonly string[]>>({});
  const [availabilityStatus, setAvailabilityStatus] = useState<'idle' | 'loading' | 'error' | 'ready'>('idle');
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successPaymentLabel, setSuccessPaymentLabel] = useState<string>('');
  const [confirmedBookingReference, setConfirmedBookingReference] = useState<string | null>(null);
  const [confirmedMeetingUrl, setConfirmedMeetingUrl] = useState<string | null>(null);
  const [confirmedSlotDisplay, setConfirmedSlotDisplay] = useState<ConfirmedSlotDisplay | null>(null);
  const [confirmedCalendarSlot, setConfirmedCalendarSlot] = useState<ConfirmedCalendarSlot | null>(null);
  const [successBookingStatus, setSuccessBookingStatus] = useState<'pending' | 'confirmed' | 'cancelled' | null>(null);

  const checkoutAmountLabel = paymentConfig?.checkoutAmountLabel ?? DEFAULT_CHECKOUT_AMOUNT_LABEL;
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
  useEffect(() => {
    const controller = new AbortController();
    void fetch(AUTH_ME_API_URL, { credentials: 'include', signal: controller.signal })
      .then(async (response) => {
        if (!response.ok || controller.signal.aborted) {
          return;
        }
        const payload: unknown = await response.json();
        if (controller.signal.aborted) {
          return;
        }
        const profile = parseMarketingProfilePrefillFromAuthMePayload(payload);
        if (profile === null) {
          return;
        }
        setFullName((previous) => (previous.trim().length === 0 && profile.fullName !== null ? profile.fullName : previous));
        setEmail((previous) => (previous.trim().length === 0 && profile.email !== null ? profile.email : previous));
        setCompany((previous) => (previous.trim().length === 0 && profile.company !== null ? profile.company : previous));
        setPhone((previous) => (previous.trim().length === 0 && profile.phone !== null ? profile.phone : previous));
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return;
        }
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }
      });
    return () => {
      controller.abort();
    };
  }, []);
  useLayoutEffect(() => {
    const paymentResult = searchParams.get('payment')?.trim() ?? '';
    const returnTransactionId = searchParams.get('transactionId')?.trim() ?? '';
    if (paymentResult !== 'success' || returnTransactionId.length === 0) {
      return;
    }
    const controller = new AbortController();
    queueMicrotask(() => {
      setPhase('processing');
    });
    void fetchPaymentTransactionStatus({
      apiBaseUrl: MARKETING_CLIENT_API_BASE_URL,
      transactionId: returnTransactionId,
      signal: controller.signal,
    })
      .then((result) => {
        if (controller.signal.aborted) {
          return;
        }
        if (result.status !== 'paid' || result.bookingId === null) {
          notifyError('Your payment is still processing. If you were charged, check your email shortly.');
          setErrorMessage('Your payment is still processing. If you were charged, check your email shortly.');
          setPhase('error');
          return;
        }
        const meetingTrimmed = result.meetingUrl?.trim() ?? '';
        setConfirmedMeetingUrl(meetingTrimmed.length > 0 ? meetingTrimmed : null);
        setSuccessBookingStatus(result.bookingStatus);
        if (result.startsAtIso !== null) {
          setConfirmedSlotDisplay(
            formatConfirmedSlotFromStartsAt(result.startsAtIso, result.timezone ?? PRIMARY_TIMEZONE),
          );
          setConfirmedCalendarSlot({
            startsAtIso: result.startsAtIso,
            timezone: result.timezone ?? PRIMARY_TIMEZONE,
          });
        }
        setSuccessPaymentLabel(result.paymentMethodLabel ?? result.gatewayId);
        if (result.bookingId !== null) {
          setConfirmedBookingReference(formatBookingReferenceId(result.bookingId));
        }
        setPhase('success');
        const cleanPath =
          pathname.startsWith('/book/') && hasValidQuizSessionParam
            ? buildMarketingBookSessionPath(quizSessionRef)
            : '/book';
        router.replace(cleanPath);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return;
        }
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }
        notifyError('Could not load your booking confirmation. Please check your email.');
        setErrorMessage('Could not load your booking confirmation. Please check your email.');
        setPhase('error');
      });
    return () => {
      controller.abort();
    };
  }, [hasValidQuizSessionParam, pathname, quizSessionRef, router, searchParams]);
  const selectedGateway = useMemo(() => {
    if (paymentConfig === null || selectedGatewayId === null) {
      return null;
    }
    return paymentConfig.gateways.find((gateway) => gateway.id === selectedGatewayId) ?? null;
  }, [paymentConfig, selectedGatewayId]);
  const availablePaymentMethods = useMemo(
    () => selectedGateway?.methods ?? [],
    [selectedGateway],
  );
  const isLivePaymentsCheckout =
    paymentConfig?.paymentsEnabled === true && (paymentConfig.gateways.length ?? 0) > 0;
  const hasMultiplePaymentGateways = (paymentConfig?.gateways.length ?? 0) > 1;
  useEffect(() => {
    if (availablePaymentMethods.length === 0) {
      queueMicrotask(() => {
        setSelectedPaymentMethodId(null);
      });
      return;
    }
    const stillValid = availablePaymentMethods.some((method) => method.id === selectedPaymentMethodId);
    if (!stillValid) {
      queueMicrotask(() => {
        setSelectedPaymentMethodId(availablePaymentMethods[0]!.id);
      });
    }
  }, [availablePaymentMethods, selectedPaymentMethodId]);
  useEffect(() => {
    const controller = new AbortController();
    void fetchMarketingServerClockOffsetMs({ apiBaseUrl: MARKETING_CLIENT_API_BASE_URL, signal: controller.signal }).then((offset) => {
      if (controller.signal.aborted || offset === null) {
        return;
      }
      setServerClockOffsetMs(offset);
    });
    return () => {
      controller.abort();
    };
  }, []);

  useEffect(() => {
    if (serverClockOffsetMs === null) {
      return;
    }
    if (hasUserNavigatedVisibleMonthRef.current) {
      return;
    }
    const serverSyncedNow = new Date(Date.now() + serverClockOffsetMs);
    setVisibleManilaYearMonth(formatInTimeZone(serverSyncedNow, PRIMARY_TIMEZONE, 'yyyy-MM'));
  }, [serverClockOffsetMs]);

  useEffect(() => {
    const keys = Object.keys(fieldErrors);
    if (keys.length === 0) {
      return;
    }
    const idByField: Record<string, string> = {
      fullName: 'booking-full-name',
      email: 'booking-email',
      phone: 'booking-phone',
    };
    const firstKey = ['fullName', 'email', 'phone'].find((key) => fieldErrors[key] !== undefined);
    if (firstKey === undefined) {
      return;
    }
    const elementId = idByField[firstKey];
    if (elementId === undefined) {
      return;
    }
    window.requestAnimationFrame(() => {
      document.getElementById(elementId)?.focus();
    });
  }, [fieldErrors]);

  const monthLabel = formatInTimeZone(
    fromZonedTime(
      parse(`${visibleManilaYearMonth}-01 12:00`, 'yyyy-MM-dd HH:mm', new Date(0)),
      PRIMARY_TIMEZONE,
    ),
    PRIMARY_TIMEZONE,
    'MMMM yyyy',
  );
  const manilaFetchBounds = useMemo(
    () => resolveManilaMonthGridYmdBounds(visibleManilaYearMonth),
    [visibleManilaYearMonth],
  );
  const selectedManilaYmd =
    selectedDate !== null ? formatInTimeZone(selectedDate, PRIMARY_TIMEZONE, 'yyyy-MM-dd') : null;
  const pendingManilaYmd = slotDialogOpen && slotDialogManilaYmd !== null ? slotDialogManilaYmd : null;

  type AvailabilityApiSlot = {
    readonly date: string;
    readonly time: string;
    readonly startsAtIso: string;
  };

  useEffect(() => {
    if (phase !== 'date') {
      return;
    }
    const from = manilaFetchBounds.from;
    const to = manilaFetchBounds.to;
    const controller = new AbortController();
    queueMicrotask(() => {
      setAvailabilityStatus('loading');
      setAvailabilityError(null);
    });
    const url = `${AVAILABILITY_API_URL}?serviceKey=${encodeURIComponent(DEFAULT_SERVICE_KEY)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
    void fetch(url, { signal: controller.signal })
      .then(async (response) => {
        const payload = (await response.json()) as { slots?: AvailabilityApiSlot[]; error?: string };
        if (!response.ok) {
          throw new Error(typeof payload.error === 'string' ? payload.error : 'Failed to load times');
        }
        return payload.slots ?? [];
      })
      .then((slots) => {
        const map: Record<string, string[]> = {};
        for (const row of slots) {
          const existing = map[row.date];
          if (existing === undefined) {
            map[row.date] = [row.time];
          } else {
            existing.push(row.time);
          }
        }
        for (const key of Object.keys(map)) {
          const list = map[key];
          if (list !== undefined) {
            sortBookingSlotTimesForManilaDate(key, list);
          }
        }
        setAvailabilityByDate(map);
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
  }, [phase, manilaFetchBounds]);

  useEffect(() => {
    if (phase !== 'date' || selectedDate === null) {
      return;
    }
    const ymd = formatInTimeZone(selectedDate, PRIMARY_TIMEZONE, 'yyyy-MM-dd');
    const times = availabilityByDate[ymd] ?? [];
    queueMicrotask(() => {
      setSelectedTime((previous) => {
        if (times.length === 0) {
          return null;
        }
        if (previous !== null && times.includes(previous)) {
          return previous;
        }
        return times[0] ?? null;
      });
    });
  }, [availabilityByDate, selectedDate, phase]);

  const slotsForSelectedDay = useMemo((): readonly string[] => {
    if (selectedDate === null) {
      return [];
    }
    return availabilityByDate[formatInTimeZone(selectedDate, PRIMARY_TIMEZONE, 'yyyy-MM-dd')] ?? [];
  }, [selectedDate, availabilityByDate]);

  const displayDateLong =
    selectedDate !== null
      ? formatInTimeZone(selectedDate, PRIMARY_TIMEZONE, 'EEEE, MMMM d, yyyy')
      : '';
  const displayTimeLabel = selectedTime ?? '';
  const confirmedDateLong = confirmedSlotDisplay?.dateLong ?? displayDateLong;
  const confirmedTimeLabel = confirmedSlotDisplay?.timeLabel ?? displayTimeLabel;
  const activeDiagnosticHref = hasValidQuizSessionParam
    ? buildMarketingQuizSessionPath(quizSessionRef)
    : '/diagnostic';

  const executeContinueFromDate = (): void => {
    if (!selectedDate || !selectedTime) {
      return;
    }
    setPhase('details');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const executeContinueFromDetails = (): void => {
    const nextErrors: Record<string, string> = {};
    const trimmedName = fullName.trim();
    const trimmedEmail = email.trim();
    const trimmedPhone = phone.trim();
    if (trimmedName.length < 2) {
      nextErrors.fullName = 'Enter your full name.';
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      nextErrors.email = 'Enter a valid email address.';
    }
    if (trimmedPhone.replace(/\s/g, '').length < 7) {
      nextErrors.phone = 'Enter a valid phone number.';
    }
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }
    setPhase('payment');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const executePay = async (): Promise<void> => {
    if (!selectedDate || !selectedTime) {
      return;
    }
    const paymentsLive = paymentConfig?.paymentsEnabled === true && (paymentConfig.gateways.length ?? 0) > 0;
    if (paymentsLive) {
      if (selectedGatewayId === null || selectedPaymentMethodId === null) {
        return;
      }
      const methodOption = availablePaymentMethods.find((method) => method.id === selectedPaymentMethodId);
      const resolvedPaymentLabel = methodOption?.label ?? selectedPaymentMethodId;
      setPhase('processing');
      setErrorMessage(null);
      const dateParam = formatInTimeZone(selectedDate, PRIMARY_TIMEZONE, 'yyyy-MM-dd');
      try {
        const session = await createPaymentCheckoutSession({
          apiBaseUrl: MARKETING_CLIENT_API_BASE_URL,
          appBaseUrl: MARKETING_CLIENT_API_BASE_URL.length > 0 ? MARKETING_CLIENT_API_BASE_URL : undefined,
          gatewayId: selectedGatewayId,
          paymentMethodId: selectedPaymentMethodId,
          date: dateParam,
          time: selectedTime,
          serviceKey: DEFAULT_SERVICE_KEY,
          customerName: fullName.trim(),
          customerEmail: email.trim(),
          customerPhone: phone.trim(),
          customerCompany: company.trim().length > 0 ? company.trim() : undefined,
          quizSessionId: hasValidQuizSessionParam && quizSessionRef.length > 0 ? quizSessionRef : undefined,
          paymentMethodLabel: resolvedPaymentLabel,
        });
        if (session.manualConfirm || session.redirectUrl === null) {
          void router.refresh();
          setSuccessPaymentLabel(resolvedPaymentLabel);
          setSuccessBookingStatus(session.bookingStatus ?? null);
          if (session.bookingId !== null) {
            setConfirmedBookingReference(formatBookingReferenceId(session.bookingId));
          }
          try {
            const slotUtc = parseBookingSlotToUtc(dateParam, selectedTime);
            setConfirmedSlotDisplay({
              dateLong: formatInTimeZone(slotUtc, PRIMARY_TIMEZONE, 'EEEE, MMMM d, yyyy'),
              timeLabel: formatInTimeZone(slotUtc, PRIMARY_TIMEZONE, 'h:mm a'),
            });
            setConfirmedCalendarSlot({ startsAtIso: slotUtc.toISOString(), timezone: PRIMARY_TIMEZONE });
          } catch {
            // Leave labels from the picker when parsing fails unexpectedly.
          }
          setPhase('success');
          return;
        }
        window.location.href = session.redirectUrl;
      } catch (error: unknown) {
        notifyError(error instanceof Error ? error.message : 'Could not start payment.');
        setErrorMessage(error instanceof Error ? error.message : 'Could not start payment.');
        setPhase('error');
      }
      return;
    }
    if (paymentMethod === null) {
      return;
    }
    const methodOption = PAYMENT_METHOD_OPTIONS.find((m) => m.id === paymentMethod);
    const resolvedPaymentLabel = methodOption?.label ?? paymentMethod;
    setPhase('processing');
    setErrorMessage(null);
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 900);
    });
    const dateParam = formatInTimeZone(selectedDate, PRIMARY_TIMEZONE, 'yyyy-MM-dd');
    const body: Record<string, string> = {
      date: dateParam,
      time: selectedTime,
      serviceKey: DEFAULT_SERVICE_KEY,
      customerName: fullName.trim(),
      customerEmail: email.trim(),
      customerPhone: phone.trim(),
      paymentMethod,
    };
    const trimmedCompany = company.trim();
    if (trimmedCompany.length > 0) {
      body.customerCompany = trimmedCompany;
    }
    if (hasValidQuizSessionParam && quizSessionRef.length > 0) {
      body.quizSessionId = quizSessionRef;
    }
    try {
      const response = await fetch(BOOKINGS_API_URL, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const payload: unknown = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message =
          typeof payload === 'object' &&
          payload !== null &&
          'error' in payload &&
          typeof (payload as { error?: unknown }).error === 'string'
            ? (payload as { error: string }).error
            : `Booking could not be saved (${response.status}).`;
        notifyError(message);
        setErrorMessage(message);
        setPhase('error');
        return;
      }
      void router.refresh();
      setSuccessPaymentLabel(resolvedPaymentLabel);
      const bookingId =
        typeof payload === 'object' &&
        payload !== null &&
        'bookingId' in payload &&
        typeof (payload as { bookingId?: unknown }).bookingId === 'string'
          ? (payload as { bookingId: string }).bookingId
          : null;
      const startsAtIsoFromServer =
        typeof payload === 'object' &&
        payload !== null &&
        'startsAtIso' in payload &&
        typeof (payload as { startsAtIso?: unknown }).startsAtIso === 'string'
          ? (payload as { startsAtIso: string }).startsAtIso
          : null;
      const timezoneFromServer =
        typeof payload === 'object' &&
        payload !== null &&
        'timezone' in payload &&
        typeof (payload as { timezone?: unknown }).timezone === 'string'
          ? (payload as { timezone: string }).timezone
          : PRIMARY_TIMEZONE;
      const bookingStatusRaw =
        typeof payload === 'object' && payload !== null && 'bookingStatus' in payload
          ? (payload as { bookingStatus?: unknown }).bookingStatus
          : null;
      const parsedBookingStatus =
        bookingStatusRaw === 'pending' || bookingStatusRaw === 'confirmed' || bookingStatusRaw === 'cancelled'
          ? bookingStatusRaw
          : null;
      setSuccessBookingStatus(parsedBookingStatus);
      const resolvedStartsIso =
        startsAtIsoFromServer ??
        ((): string | null => {
          try {
            return parseBookingSlotToUtc(dateParam, selectedTime).toISOString();
          } catch {
            return null;
          }
        })();
      if (resolvedStartsIso !== null) {
        setConfirmedCalendarSlot({ startsAtIso: resolvedStartsIso, timezone: timezoneFromServer });
        setConfirmedSlotDisplay(formatConfirmedSlotFromStartsAt(resolvedStartsIso, timezoneFromServer));
      }
      if (bookingId !== null) {
        setConfirmedBookingReference(formatBookingReferenceId(bookingId));
      }
      setPhase('success');
    } catch {
      notifyError('Network error while saving your booking. Check your connection and try again.');
      setErrorMessage('Network error while saving your booking. Check your connection and try again.');
      setPhase('error');
    }
  };

  const executeBackToDate = (): void => {
    setFieldErrors({});
    setPhase('date');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const executeBackToDetails = (): void => {
    setPhase('details');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const executeRetryFromError = (): void => {
    setPhase('payment');
    setErrorMessage(null);
  };

  if (phase === 'processing') {
    return (
      <div className="mx-auto max-w-lg px-6 py-16 md:py-24">
        <div className="flex items-start gap-4">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
            4
          </span>
          <div>
            <h1 className="text-balance text-2xl font-semibold tracking-tight text-foreground">Confirming your booking</h1>
            <p className="mt-2 text-sm text-muted-foreground">Please wait while we confirm your booking.</p>
          </div>
        </div>
        <div className="mt-10 flex flex-col items-center rounded-3xl border border-border bg-primary/5 px-6 py-12">
          <div className="flex size-28 items-center justify-center rounded-full bg-primary/10">
            <Lock className="size-12 text-primary" aria-hidden />
          </div>
          <Loader2 className="mt-8 size-8 animate-spin text-primary" aria-hidden />
          <p className="mt-6 text-center text-sm font-semibold text-foreground">Processing your payment…</p>
          <p className="mt-2 text-center text-sm text-muted-foreground">This will only take a few seconds.</p>
        </div>
        <div className="mt-8 flex gap-3 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-foreground">
          <Shield className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
          <p>
            <span className="font-semibold">Do not close this window or refresh the page.</span>
          </p>
        </div>
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <div className="mx-auto max-w-lg px-6 py-16 md:py-24">
        <h1 className="text-balance text-2xl font-semibold tracking-tight text-foreground">We could not complete checkout</h1>
        <p className="mt-3 text-muted-foreground">{errorMessage ?? 'Something went wrong.'}</p>
        <div className="mt-10 flex flex-wrap gap-3">
          <Button type="button" size="lg" onClick={executeRetryFromError}>
            Try again
          </Button>
          <Button type="button" size="lg" variant="outline" asChild>
            <Link href={activeDiagnosticHref}>Back to diagnostic</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (phase === 'success') {
    return (
      <div className="mx-auto max-w-xl px-6 py-12 md:py-20">
        <div className="flex flex-col items-center text-center">
          <div className="flex size-20 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="size-11" aria-hidden />
          </div>
          <h1 className="mt-8 text-balance text-3xl font-semibold tracking-tight text-foreground">Booking confirmed!</h1>
          <p className="mt-2 text-muted-foreground">Your consultation is all set.</p>
        </div>
        <div className="mt-10 space-y-4 rounded-2xl border border-border bg-card p-6 text-left shadow-xs">
          <div className="flex gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <CalendarClock className="size-5 text-primary" aria-hidden />
            </span>
            <div>
              <p className="text-xs font-medium text-muted-foreground">When</p>
              <p className="text-sm font-semibold text-foreground">{confirmedDateLong}</p>
              <p className="text-sm font-semibold text-foreground">{confirmedTimeLabel}</p>
              <p className="text-xs text-muted-foreground">{PRIMARY_TIMEZONE}</p>
              {confirmedCalendarSlot !== null && successBookingStatus === 'confirmed' ? (
                <AddToCalendarButtons
                  className="mt-3"
                  startsAtIso={confirmedCalendarSlot.startsAtIso}
                  title={PROJECT_RESCUE_SERVICE_TITLE}
                  description={
                    confirmedBookingReference !== null
                      ? `Booking reference ${confirmedBookingReference}. ${PROJECT_RESCUE_SERVICE_TAGLINE}`
                      : PROJECT_RESCUE_SERVICE_TAGLINE
                  }
                  icsUidSeed={confirmedBookingReference ?? confirmedCalendarSlot.startsAtIso}
                  location={confirmedMeetingUrl ?? undefined}
                />
              ) : null}
            </div>
          </div>
          <div className="flex gap-3 border-t border-border pt-4">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <Video className="size-5 text-primary" aria-hidden />
            </span>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Meeting</p>
              {confirmedMeetingUrl !== null ? (
                <>
                  <p className="text-sm font-semibold text-foreground">Video call</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Join link:{' '}
                    <a
                      href={confirmedMeetingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-primary underline-offset-4 hover:underline"
                    >
                      Open meeting
                    </a>
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">The same link is in your confirmation email.</p>
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold text-foreground">Video meeting</p>
                  <p className="text-xs text-muted-foreground">
                    Your confirmation email will include the join link once the meeting is provisioned.
                  </p>
                </>
              )}
            </div>
          </div>
          {confirmedBookingReference !== null ? (
            <div className="border-t border-border pt-4">
              <p className="text-xs font-medium text-muted-foreground">Booking reference</p>
              <p className="mt-1 font-mono text-sm font-semibold tracking-wider text-foreground">{confirmedBookingReference}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Save this reference to check status or pay later.
                {manageBookingEnabled ? (
                  <>
                    {' '}
                    <Link href="/book/manage" className="font-medium text-primary underline-offset-4 hover:underline">
                      Manage booking
                    </Link>
                  </>
                ) : null}
              </p>
            </div>
          ) : null}
        </div>
        <div className="mt-4 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-5 py-4">
          <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="size-5 shrink-0" aria-hidden />
            <p className="text-sm font-semibold">Payment successful</p>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-muted-foreground">Amount paid</dt>
              <dd className="font-semibold text-foreground">{checkoutAmountLabel}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Payment method</dt>
              <dd className="font-semibold text-foreground">{successPaymentLabel}</dd>
            </div>
          </dl>
        </div>
        <Button asChild className="mt-10 w-full" size="lg">
          <Link href="/account/diagnostics">Go to dashboard</Link>
        </Button>
        <Button asChild className="mt-3 w-full" variant="ghost">
          <Link href="/">Back to home</Link>
        </Button>
      </div>
    );
  }

  const activeSlotPhase: BookingSlotPhase =
    phase === 'date' || phase === 'details' || phase === 'payment' ? phase : 'date';
  return (
    <div className="mx-auto px-6 py-12">
      <div className="mb-8 space-y-3 lg:sticky lg:top-16 lg:z-40 lg:-mx-6 lg:border-b lg:border-border lg:bg-background lg:px-6 lg:py-2 lg:shadow-md lg:backdrop-blur lg:supports-backdrop-filter:bg-background/92">
        <BookingStepper activePhase={activeSlotPhase} />
      </div>
      <div className="max-w-6xl mx-auto">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary mt-8">Booking</p>
        <h1 className="mt-2 text-balance text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
          {phase === 'date' && 'Choose Date & Time'}
          {phase === 'details' && 'Your Details'}
          {phase === 'payment' && 'Payment'}
        </h1>
        <p className="mt-2 text-pretty text-muted-foreground">
          {phase === 'date' &&
            `Select a slot in Philippine Time (${PRIMARY_TIMEZONE}). You can add calendar sync later — this flow captures your preference now.`}
          {phase === 'details' &&
            'We use this information only to confirm your reservation and to send your calendar invite and meeting link.'}
          {phase === 'payment' && 'Choose a payment method to secure your booking.'}
        </p>
        {phase === 'date' && manageBookingEnabled ? (
          <p className="mt-2 text-sm text-muted-foreground">
            <Link href="/book/manage" className="font-medium text-primary underline-offset-4 hover:underline">
              Already booked? Manage your booking
            </Link>
          </p>
        ) : null}
        {phase === 'date' ? (
          <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_min(100%,22rem)] lg:items-start lg:gap-x-8 xl:gap-x-10">
            <div className="min-w-0 space-y-8 lg:space-y-0">
              <section className="rounded-2xl border border-border bg-card p-4 shadow-xs sm:p-6">
                <div className="flex items-center justify-between gap-4">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="shrink-0"
                    aria-label="Previous month"
                    onClick={() => {
                      hasUserNavigatedVisibleMonthRef.current = true;
                      setVisibleManilaYearMonth((previous) => addManilaYearMonth(previous, -1));
                    }}
                  >
                    <ChevronLeft className="size-4" />
                  </Button>
                  <p className="text-sm font-semibold text-foreground">{monthLabel}</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="shrink-0"
                    aria-label="Next month"
                    onClick={() => {
                      hasUserNavigatedVisibleMonthRef.current = true;
                      setVisibleManilaYearMonth((previous) => addManilaYearMonth(previous, 1));
                    }}
                  >
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
                <div className="mt-6">
                  <BookingMonthFullCalendar
                    visibleManilaYearMonth={visibleManilaYearMonth}
                    availabilityByDate={availabilityByDate}
                    availabilityReady={availabilityStatus === 'ready'}
                    selectedManilaYmd={selectedManilaYmd}
                    pendingManilaYmd={pendingManilaYmd}
                    onSelectDateWithSlots={(manilaYmd) => {
                      setSlotDialogManilaYmd(manilaYmd);
                      setSlotDialogOpen(true);
                    }}
                  />
                </div>
              </section>
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
                        : 'Philippine Time'}
                    </DialogDescription>
                  </DialogHeader>
                  <p className="pb-4 text-xs text-muted-foreground">{PRIMARY_TIMEZONE}</p>
                  {availabilityStatus === 'loading' ? (
                    <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
                      <Loader2 className="size-4 animate-spin shrink-0" aria-hidden />
                      Loading open times…
                    </p>
                  ) : null}
                  {availabilityStatus === 'error' ? (
                    <p className="py-4 text-sm text-destructive">{availabilityError ?? 'Could not load times.'}</p>
                  ) : null}
                  {slotDialogManilaYmd !== null &&
                  availabilityStatus === 'ready' &&
                  (availabilityByDate[slotDialogManilaYmd]?.length ?? 0) === 0 ? (
                    <p className="py-4 text-sm text-muted-foreground">No times on this date. Pick another day.</p>
                  ) : null}
                  {slotDialogManilaYmd !== null && availabilityStatus === 'ready' ? (
                    <ul className="max-h-[min(50vh,22rem)] space-y-2 overflow-y-auto py-1 pr-1">
                      {(availabilityByDate[slotDialogManilaYmd] ?? []).map((slot) => (
                        <li key={slot}>
                          <button
                            type="button"
                            className="min-h-11 w-full rounded-xl border border-border px-3 py-2.5 text-left text-sm font-medium transition-colors hover:border-primary/40 hover:bg-muted/50"
                            onClick={() => {
                              const picked = fromZonedTime(
                                parse(`${slotDialogManilaYmd} 12:00`, 'yyyy-MM-dd HH:mm', new Date(0)),
                                PRIMARY_TIMEZONE,
                              );
                              setSelectedDate(picked);
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
            </div>
            <aside
              aria-label="Booking selection"
              className="mx-auto flex w-full max-w-lg flex-col gap-4 lg:mx-0 lg:max-w-none lg:sticky lg:top-44 lg:z-45 lg:self-start lg:min-h-0 lg:rounded-2xl lg:border lg:border-border lg:bg-card lg:p-5 lg:shadow-xs xl:p-6"
            >
              {availabilityStatus === 'loading' ? (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin shrink-0" aria-hidden />
                  Loading open times…
                </p>
              ) : null}
              {availabilityStatus === 'error' ? (
                <p className="text-sm text-destructive">{availabilityError ?? 'Could not load times.'}</p>
              ) : null}
              {availabilityStatus === 'ready' && (selectedDate === null || selectedTime === null) ? (
                <div className="rounded-2xl border border-dashed border-border/90 bg-muted/20 px-4 py-6 text-sm lg:min-h-44 lg:py-8">
                  <p className="font-semibold text-foreground">Pick a date and time</p>
                  <p className="mt-2 text-pretty leading-relaxed text-muted-foreground">
                    Tap any day in the calendar that has open slots. When the time list opens, choose a slot — your
                    selection will appear here, and the day stays highlighted on the calendar.
                  </p>
                </div>
              ) : null}
              {availabilityStatus === 'ready' && selectedDate !== null && selectedTime !== null ? (
                <div className="rounded-2xl border border-border bg-muted/30 px-4 py-3 text-sm">
                  <p className="font-semibold text-foreground">Your selection</p>
                  <p className="mt-1 text-muted-foreground">
                    {displayDateLong} · {selectedTime} · {PRIMARY_TIMEZONE}
                  </p>
                </div>
              ) : null}
              <div className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="h-auto min-h-10 w-full min-w-0 whitespace-normal px-3 py-2.5 text-center leading-snug"
                  asChild
                >
                  <Link
                    href={activeDiagnosticHref}
                    className="inline-flex items-center justify-center gap-2"
                  >
                    <ChevronLeft className="size-4 shrink-0" aria-hidden />
                    Back
                  </Link>
                </Button>
                <Button
                  type="button"
                  className="h-auto min-h-10 w-full min-w-0 whitespace-normal px-3 py-2.5 text-center leading-snug"
                  size="lg"
                  disabled={
                    !selectedDate ||
                    !selectedTime ||
                    availabilityStatus === 'loading' ||
                    (availabilityStatus === 'ready' && slotsForSelectedDay.length === 0)
                  }
                  onClick={executeContinueFromDate}
                >
                  Next
                </Button>
              </div>
            </aside>
          </div>
        ) : null}
        {phase === 'details' ? (
          <div className="mt-10 mx-auto w-full max-w-lg lg:max-w-3xl">
            <section
              aria-labelledby="booking-contact-heading"
              className="rounded-2xl border border-border bg-card shadow-xs ring-1 ring-border/40"
            >
              <div className="border-b border-border/80 px-6 py-6 sm:px-8 sm:py-7">
                <h2
                  id="booking-contact-heading"
                  className="text-base font-semibold tracking-tight text-foreground sm:text-lg"
                >
                  Contact information
                </h2>
                <p className="mt-2 max-w-prose text-pretty text-sm leading-relaxed text-muted-foreground">
                  Use the same email you check regularly — that is where we will send confirmations and updates.
                </p>
              </div>
              <div className="px-6 py-8 sm:px-8">
                <div className="grid grid-cols-1 gap-7 lg:grid-cols-2 lg:gap-x-8 lg:gap-y-7">
                  <div className="min-w-0 space-y-2.5">
                    <label htmlFor="booking-full-name" className="block text-sm font-semibold leading-none text-foreground">
                      Full name <span className="font-normal text-destructive">*</span>
                    </label>
                    <Input
                      id="booking-full-name"
                      autoComplete="name"
                      className="h-12 touch-manipulation rounded-xl border-border/90 text-base shadow-none sm:text-sm"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Juan Dela Cruz"
                      aria-invalid={fieldErrors.fullName !== undefined}
                      aria-describedby={fieldErrors.fullName !== undefined ? 'booking-full-name-error' : undefined}
                    />
                    {fieldErrors.fullName ? (
                      <p id="booking-full-name-error" className="flex gap-2 text-sm text-destructive" role="alert">
                        <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
                        <span>{fieldErrors.fullName}</span>
                      </p>
                    ) : null}
                  </div>
                  <div className="min-w-0 space-y-2.5">
                    <label htmlFor="booking-email" className="block text-sm font-semibold leading-none text-foreground">
                      Email address <span className="font-normal text-destructive">*</span>
                    </label>
                    <Input
                      id="booking-email"
                      type="email"
                      autoComplete="email"
                      inputMode="email"
                      className="h-12 touch-manipulation rounded-xl border-border/90 text-base shadow-none sm:text-sm"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="juan.delacruz@email.com"
                      aria-invalid={fieldErrors.email !== undefined}
                      aria-describedby={fieldErrors.email !== undefined ? 'booking-email-error' : undefined}
                    />
                    {fieldErrors.email ? (
                      <p id="booking-email-error" className="flex gap-2 text-sm text-destructive" role="alert">
                        <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
                        <span>{fieldErrors.email}</span>
                      </p>
                    ) : null}
                  </div>
                  <div className="min-w-0 space-y-2.5">
                    <label htmlFor="booking-company" className="block text-sm font-semibold leading-none text-foreground">
                      Company / business name{' '}
                      <span className="font-normal text-muted-foreground">(optional)</span>
                    </label>
                    <Input
                      id="booking-company"
                      autoComplete="organization"
                      className="h-12 touch-manipulation rounded-xl border-border/90 text-base shadow-none sm:text-sm"
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      placeholder="ABC Trading"
                    />
                  </div>
                  <div className="min-w-0 space-y-2.5">
                    <label htmlFor="booking-phone" className="block text-sm font-semibold leading-none text-foreground">
                      Phone number <span className="font-normal text-destructive">*</span>
                    </label>
                    <Input
                      id="booking-phone"
                      type="tel"
                      autoComplete="tel"
                      inputMode="tel"
                      className="h-12 touch-manipulation rounded-xl border-border/90 text-base shadow-none sm:text-sm"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="0912 345 6789"
                      aria-invalid={fieldErrors.phone !== undefined}
                      aria-describedby={fieldErrors.phone !== undefined ? 'booking-phone-error' : undefined}
                    />
                    {fieldErrors.phone ? (
                      <p id="booking-phone-error" className="flex gap-2 text-sm text-destructive" role="alert">
                        <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
                        <span>{fieldErrors.phone}</span>
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="mt-10 flex flex-col gap-3 border-t border-border/80 pt-8 sm:flex-row sm:items-stretch sm:gap-4">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-12 min-h-12 shrink-0 gap-2 sm:w-auto sm:px-6"
                    onClick={executeBackToDate}
                  >
                    <ChevronLeft className="size-4" aria-hidden />
                    Back
                  </Button>
                  <Button
                    type="button"
                    className="h-12 min-h-12 flex-1 text-base font-semibold sm:min-w-0"
                    size="lg"
                    onClick={executeContinueFromDetails}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </section>
          </div>
        ) : null}
        {phase === 'payment' ? (
          <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_340px] lg:items-start">
            <div className="space-y-6">
              {isLivePaymentsCheckout && hasMultiplePaymentGateways && paymentConfig !== null ? (
                <fieldset>
                  <legend className="text-sm font-semibold text-foreground">Payment gateway</legend>
                  <div className="mt-4 space-y-3">
                    {paymentConfig.gateways.map((gateway) => {
                        const isSelected = selectedGatewayId === gateway.id;
                        return (
                          <label
                            key={gateway.id}
                            className={cn(
                              'flex cursor-pointer items-center gap-4 rounded-2xl border bg-card p-4 shadow-xs transition-colors',
                              isSelected ? 'border-primary ring-2 ring-primary/25' : 'border-border hover:border-primary/30',
                            )}
                          >
                            <input
                              type="radio"
                              name="payment-gateway"
                              value={gateway.id}
                              checked={isSelected}
                              onChange={() => {
                                setSelectedGatewayId(gateway.id);
                                setSelectedPaymentMethodId(gateway.methods[0]?.id ?? null);
                              }}
                              className="size-4 accent-primary"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-foreground">{gateway.label}</p>
                              <p className="text-xs text-muted-foreground">{gateway.description}</p>
                            </div>
                            <CreditCard className="size-6 shrink-0 text-muted-foreground" aria-hidden />
                          </label>
                        );
                      })}
                  </div>
                </fieldset>
              ) : null}
              {!isLivePaymentsCheckout ? (
                <fieldset>
                  <legend className="text-sm font-semibold text-foreground">Payment method</legend>
                  <div className="mt-4 space-y-3">
                    {PAYMENT_METHOD_OPTIONS.map((option) => {
                      const isSelected = paymentMethod === option.id;
                      return (
                        <label
                          key={option.id}
                          className={cn(
                            'flex cursor-pointer items-center gap-4 rounded-2xl border bg-card p-4 shadow-xs transition-colors',
                            isSelected ? 'border-primary ring-2 ring-primary/25' : 'border-border hover:border-primary/30',
                          )}
                        >
                          <input
                            type="radio"
                            name="payment-method"
                            value={option.id}
                            checked={isSelected}
                            onChange={() => setPaymentMethod(option.id)}
                            className="size-4 accent-primary"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-foreground">{option.label}</p>
                            <p className="text-xs text-muted-foreground">{option.hint}</p>
                          </div>
                          {option.id === 'card' ? (
                            <CreditCard className="size-6 shrink-0 text-muted-foreground" aria-hidden />
                          ) : null}
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              ) : null}
              {isLivePaymentsCheckout && availablePaymentMethods.length > 0 ? (
                <fieldset>
                  <legend className="text-sm font-semibold text-foreground">Payment method</legend>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Choose how you want to pay. You will complete payment on {selectedGateway?.label ?? 'the provider'}.
                  </p>
                  <div className="mt-4 space-y-3">
                    {availablePaymentMethods.map((method) => {
                      const isSelected = selectedPaymentMethodId === method.id;
                      return (
                        <label
                          key={method.id}
                          className={cn(
                            'flex cursor-pointer items-center gap-4 rounded-2xl border bg-card p-4 shadow-xs transition-colors',
                            isSelected ? 'border-primary ring-2 ring-primary/25' : 'border-border hover:border-primary/30',
                          )}
                        >
                          <input
                            type="radio"
                            name="payment-method-live"
                            value={method.id}
                            checked={isSelected}
                            onChange={() => setSelectedPaymentMethodId(method.id)}
                            className="size-4 accent-primary"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-foreground">{method.label}</p>
                            <p className="text-xs text-muted-foreground">{method.hint}</p>
                          </div>
                          {method.id === 'card' ? (
                            <CreditCard className="size-6 shrink-0 text-muted-foreground" aria-hidden />
                          ) : null}
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              ) : null}
              {paymentConfig?.sandboxMode ? (
                <p className="text-xs font-medium text-amber-700">Sandbox mode — test payments only.</p>
              ) : null}
            </div>
            <aside className="space-y-4 lg:sticky lg:top-44 lg:z-45">
              <div className="rounded-2xl border border-border bg-muted/30 p-5">
                <p className="text-sm font-semibold text-foreground">{PROJECT_RESCUE_SERVICE_TITLE}</p>
                <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <dt className="text-xs text-muted-foreground">Duration</dt>
                    <dd className="mt-1 font-semibold text-foreground">{PROJECT_RESCUE_SESSION_DURATION}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Amount</dt>
                    <dd className="mt-1 font-semibold text-foreground">{checkoutAmountLabel}</dd>
                  </div>
                </dl>
                <p className="mt-2 text-xs text-muted-foreground">Inclusive of VAT</p>
              </div>
              <div className="flex gap-3 rounded-2xl border border-primary/15 bg-primary/5 px-4 py-3">
                <Lock className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
                <div>
                  <p className="text-sm font-semibold text-foreground">Secure checkout</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Your payment is safe and encrypted. We never store your card details on this site.
                  </p>
                </div>
              </div>
              <div className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="h-auto min-h-10 w-full min-w-0 gap-2 whitespace-normal px-3 py-2.5 text-center leading-snug"
                  onClick={executeBackToDetails}
                >
                  <ChevronLeft className="size-4 shrink-0" aria-hidden />
                  Back
                </Button>
                <Button
                  type="button"
                  className="h-auto min-h-10 w-full min-w-0 gap-2 whitespace-normal px-3 py-2.5 text-center leading-snug"
                  size="lg"
                  disabled={
                    paymentConfig?.paymentsEnabled
                      ? selectedGatewayId === null || selectedPaymentMethodId === null
                      : paymentMethod === null
                  }
                  onClick={() => void executePay()}
                >
                  <Lock className="size-4 shrink-0" aria-hidden />
                  {paymentConfig?.paymentPolicy === 'manual_confirm'
                    ? 'Submit booking'
                    : `Pay ${checkoutAmountLabel}`}
                </Button>
              </div>
            </aside>
          </div>
        ) : null}
      </div>
    </div>
  );
}
