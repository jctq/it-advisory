'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactElement } from 'react';
import { formatInTimeZone } from 'date-fns-tz';
import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  Headphones,
  Loader2,
  Mic,
  Monitor,
  Search,
  Video,
  Wifi,
} from 'lucide-react';
import {
  fetchMarketingServerClockOffsetMs,
} from '@techmd/api-client/marketing-booking-api-client';
import {
  BookingSessionLookupError,
  lookupAccountBookingSession,
  lookupAccountBookingSessionByReference,
  lookupGuestBookingSession,
  type GuestBookingManageCredentials,
  type GuestBookingManageView,
} from '@techmd/api-client/marketing-booking-manage-api-client';
import { PROJECT_RESCUE_SERVICE_TITLE, PROJECT_RESCUE_SERVICE_TAGLINE } from '@techmd/diagnostic-core/project-rescue-service-context';
import { AddToCalendarButtons } from '@/components/marketing/add-to-calendar-buttons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useServerSyncedNow } from '@/hooks/marketing/use-server-synced-now';
import { buildApiUrl } from '@/lib/config/build-api-url';
import {
  resolveBookingJoinCalendarLocation,
  resolveBookingReferenceFromBookingId,
} from '@/lib/marketing/booking-session-room-path';
import {
  buildBookingSessionCountdownParts,
  formatBookingSessionCountdownLabel,
  isBookingSessionEndedByFathom,
  resolveBookingSessionDisplayPhase,
  resolveBookingSessionTiming,
  type BookingSessionPhase,
} from '@/lib/marketing/booking-session-timing';
import { openMeetingWindow } from '@/lib/marketing/open-meeting-window';
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
const SESSION_ROOM_POLL_INTERVAL_MS = 25_000;

type SessionRefreshContext =
  | { readonly kind: 'guest'; readonly credentials: GuestBookingManageCredentials }
  | { readonly kind: 'account'; readonly bookingId: string }
  | { readonly kind: 'account-by-reference'; readonly bookingReference: string };

const sessionCardClass = cn(
  'rounded-xl border border-border/60 bg-card/50 shadow-xs',
  'dark:border-border/50 dark:bg-card/35',
  'md:border-border md:bg-card md:shadow-sm',
);

type SessionRoomPhase = 'lookup' | 'room';

function resolveServiceTitle(serviceKey: string): string {
  return serviceKey === 'project-rescue' ? PROJECT_RESCUE_SERVICE_TITLE : serviceKey;
}

function resolvePhaseLabel(phase: BookingSessionPhase): string {
  if (phase === 'upcoming') {
    return 'Upcoming';
  }
  if (phase === 'starting-soon') {
    return 'Starting soon';
  }
  if (phase === 'live') {
    return 'In progress';
  }
  return 'Ended';
}

function resolvePhaseBadgeClassName(phase: BookingSessionPhase): string {
  if (phase === 'live') {
    return 'bg-emerald-600/15 text-emerald-800 hover:bg-emerald-600/15 dark:text-emerald-200';
  }
  if (phase === 'starting-soon') {
    return 'bg-amber-500/15 text-amber-900 hover:bg-amber-500/15 dark:text-amber-200';
  }
  if (phase === 'ended') {
    return 'border-border/60 bg-muted/40 text-muted-foreground';
  }
  return 'bg-primary/10 text-primary';
}

function formatSlotDisplay(startsAtIso: string, timezone: string): { readonly date: string; readonly time: string } {
  const startsAt = new Date(startsAtIso);
  return {
    date: formatInTimeZone(startsAt, timezone, 'EEEE, MMMM d, yyyy'),
    time: formatInTimeZone(startsAt, timezone, 'h:mm a'),
  };
}

export function BookingSessionRoomFlow(props: {
  readonly bookingSessionRoomLinksEnabled?: boolean;
}): ReactElement {
  const bookingSessionRoomLinksEnabled = props.bookingSessionRoomLinksEnabled ?? true;
  const searchParams = useSearchParams();
  const [roomPhase, setRoomPhase] = useState<SessionRoomPhase>('lookup');
  const [bookingReference, setBookingReference] = useState('');
  const [email, setEmail] = useState('');
  const [phoneLastFour, setPhoneLastFour] = useState('');
  const [booking, setBooking] = useState<GuestBookingManageView | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [serverClockOffsetMs, setServerClockOffsetMs] = useState<number | null>(null);
  const [popupBlocked, setPopupBlocked] = useState(false);
  const [refreshContext, setRefreshContext] = useState<SessionRefreshContext | null>(null);
  const hasAttemptedBootstrapRef = useRef(false);
  const serverNowMs = useServerSyncedNow(serverClockOffsetMs);
  const enterSessionRoom = useCallback(
    (result: GuestBookingManageView, context: SessionRefreshContext): void => {
      setBooking(result);
      setRefreshContext(context);
      setRoomPhase('room');
      setLookupError(null);
    },
    [],
  );
  useEffect(() => {
    const controller = new AbortController();
    void fetchMarketingServerClockOffsetMs({
      apiBaseUrl: MARKETING_CLIENT_API_BASE_URL,
      signal: controller.signal,
    }).then((offset) => {
      if (!controller.signal.aborted && offset !== null) {
        setServerClockOffsetMs(offset);
      }
    });
    return () => {
      controller.abort();
    };
  }, []);
  const executeLookup = useCallback(
    async (credentials: GuestBookingManageCredentials): Promise<void> => {
      setIsSubmitting(true);
      setLookupError(null);
      try {
        const result = await lookupGuestBookingSession({
          apiBaseUrl: MARKETING_CLIENT_API_BASE_URL,
          credentials,
        });
        setBooking(result);
        setRefreshContext({ kind: 'guest', credentials });
        setRoomPhase('room');
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Lookup failed.';
        setLookupError(message);
        notifyError(message);
      } finally {
        setIsSubmitting(false);
      }
    },
    [],
  );
  useEffect(() => {
    if (hasAttemptedBootstrapRef.current) {
      return;
    }
    const bookingReferenceFromQuery = searchParams.get('bookingReference')?.trim() ?? '';
    const bookingIdFromQuery = searchParams.get('bookingId')?.trim() ?? '';
    if (bookingReferenceFromQuery.length >= 4) {
      hasAttemptedBootstrapRef.current = true;
      setBookingReference(bookingReferenceFromQuery);
      setIsSubmitting(true);
      void lookupAccountBookingSessionByReference({
        apiBaseUrl: MARKETING_CLIENT_API_BASE_URL,
        bookingReference: bookingReferenceFromQuery,
      })
        .then((result) => {
          enterSessionRoom(result, {
            kind: 'account-by-reference',
            bookingReference: bookingReferenceFromQuery,
          });
        })
        .catch((error: unknown) => {
          if (error instanceof BookingSessionLookupError) {
            if (error.statusCode === 401 || error.statusCode === 404) {
              return;
            }
          }
          const message = error instanceof Error ? error.message : 'Booking lookup failed.';
          setLookupError(message);
          notifyError(message);
        })
        .finally(() => {
          setIsSubmitting(false);
        });
      return;
    }
    if (!MONGO_OBJECT_ID_HEX.test(bookingIdFromQuery)) {
      return;
    }
    hasAttemptedBootstrapRef.current = true;
    setIsSubmitting(true);
    void lookupAccountBookingSession({
      apiBaseUrl: MARKETING_CLIENT_API_BASE_URL,
      bookingId: bookingIdFromQuery,
    })
      .then((result) => {
        enterSessionRoom(result, { kind: 'account', bookingId: bookingIdFromQuery });
      })
      .catch((error: unknown) => {
        if (error instanceof BookingSessionLookupError && error.statusCode === 401) {
          setBookingReference(resolveBookingReferenceFromBookingId(bookingIdFromQuery));
          return;
        }
        const message = error instanceof Error ? error.message : 'Booking lookup failed.';
        setLookupError(message);
        notifyError(message);
      })
      .finally(() => {
        setIsSubmitting(false);
      });
  }, [enterSessionRoom, searchParams]);
  const handleLookupSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>): Promise<void> => {
      event.preventDefault();
      await executeLookup({
        bookingReference: bookingReference.trim(),
        email: email.trim(),
        phoneLastFour: phoneLastFour.trim(),
      });
    },
    [bookingReference, email, executeLookup, phoneLastFour],
  );
  useEffect(() => {
    if (roomPhase !== 'room' || refreshContext === null || booking === null) {
      return;
    }
    if (isBookingSessionEndedByFathom({ sessionEndedAtIso: booking.sessionEndedAtIso, bookingStatus: booking.status })) {
      return;
    }
    const controller = new AbortController();
    const refreshBooking = (): void => {
      const request =
        refreshContext.kind === 'guest'
          ? lookupGuestBookingSession({
              apiBaseUrl: MARKETING_CLIENT_API_BASE_URL,
              credentials: refreshContext.credentials,
              signal: controller.signal,
            })
          : refreshContext.kind === 'account'
            ? lookupAccountBookingSession({
                apiBaseUrl: MARKETING_CLIENT_API_BASE_URL,
                bookingId: refreshContext.bookingId,
                signal: controller.signal,
              })
            : lookupAccountBookingSessionByReference({
                apiBaseUrl: MARKETING_CLIENT_API_BASE_URL,
                bookingReference: refreshContext.bookingReference,
                signal: controller.signal,
              });
      void request
        .then((result) => {
          if (!controller.signal.aborted) {
            setBooking(result);
          }
        })
        .catch(() => {
          /* ignore transient poll failures */
        });
    };
    const intervalId = window.setInterval(refreshBooking, SESSION_ROOM_POLL_INTERVAL_MS);
    return () => {
      controller.abort();
      window.clearInterval(intervalId);
    };
  }, [booking, refreshContext, roomPhase]);
  if (roomPhase === 'lookup') {
    return (
      <div className="mx-auto max-w-lg">
        <p className="mb-4 text-sm leading-relaxed text-muted-foreground md:mb-6">
          Enter your booking details to open your consultation session room. You can join the video call from here when
          your session window opens.
        </p>
        {lookupError !== null ? (
          <div
            className="mb-4 flex gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
            role="alert"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <p>{lookupError}</p>
          </div>
        ) : null}
        <form className={cn(sessionCardClass, 'space-y-5 p-4 md:p-6')} onSubmit={handleLookupSubmit} noValidate>
          <SessionField
            id="session-booking-reference"
            label="Booking reference"
            value={bookingReference}
            onChange={setBookingReference}
            placeholder="e.g. A1B2C3D4"
            autoComplete="off"
            className="font-mono uppercase tracking-wider"
          />
          <SessionField
            id="session-booking-email"
            label="Email"
            type="email"
            value={email}
            onChange={setEmail}
            placeholder="you@company.com"
            autoComplete="email"
          />
          <SessionField
            id="session-booking-phone-last-four"
            label="Phone (last 4 digits)"
            helperText="Use the same mobile number you entered when booking."
            value={phoneLastFour}
            onChange={(value) => setPhoneLastFour(value.replace(/\D/g, '').slice(0, 4))}
            placeholder="6789"
            inputMode="numeric"
            autoComplete="tel-national"
            maxLength={4}
            className="font-mono tracking-widest"
          />
          <Button type="submit" size="lg" className="w-full gap-2" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Search className="size-4" aria-hidden />}
            Open session room
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Need to reschedule or pay?{' '}
          <Link href="/book/manage" className="font-medium text-primary underline-offset-4 hover:underline">
            Manage your booking
          </Link>
        </p>
      </div>
    );
  }
  if (booking === null) {
    return (
      <div className={cn(sessionCardClass, 'flex items-center justify-center gap-3 px-6 py-14')}>
        <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden />
        <p className="text-sm text-muted-foreground">Loading your session…</p>
      </div>
    );
  }
  return (
    <BookingSessionRoomView
      booking={booking}
      bookingSessionRoomLinksEnabled={bookingSessionRoomLinksEnabled}
      serverNowMs={serverNowMs}
      popupBlocked={popupBlocked}
      onPopupBlockedChange={setPopupBlocked}
      onLeaveRoom={() => {
        setRoomPhase('lookup');
        setBooking(null);
        setRefreshContext(null);
      }}
    />
  );
}

type BookingSessionRoomViewProps = {
  readonly booking: GuestBookingManageView;
  readonly bookingSessionRoomLinksEnabled: boolean;
  readonly serverNowMs: number | null;
  readonly popupBlocked: boolean;
  readonly onPopupBlockedChange: (blocked: boolean) => void;
  readonly onLeaveRoom: () => void;
};

function BookingSessionRoomView(props: BookingSessionRoomViewProps): ReactElement {
  const { booking, serverNowMs } = props;
  const serviceTitle = resolveServiceTitle(booking.serviceKey);
  const slotDisplay = formatSlotDisplay(booking.startsAtIso, booking.timezone);
  const timing = useMemo(() => {
    if (serverNowMs === null) {
      return null;
    }
    return resolveBookingSessionTiming({
      startsAtIso: booking.startsAtIso,
      serverNowMs,
    });
  }, [booking.startsAtIso, serverNowMs]);
  const sessionEndedByFathom = isBookingSessionEndedByFathom({
    sessionEndedAtIso: booking.sessionEndedAtIso,
    bookingStatus: booking.status,
  });
  const displayPhase = useMemo(
    () =>
      resolveBookingSessionDisplayPhase({
        timing,
        sessionEndedAtIso: booking.sessionEndedAtIso,
        bookingStatus: booking.status,
      }),
    [booking.sessionEndedAtIso, booking.status, timing],
  );
  const countdownParts = useMemo(() => {
    if (timing === null || displayPhase === 'live' || displayPhase === 'ended') {
      return null;
    }
    return buildBookingSessionCountdownParts(timing.msUntilStart);
  }, [displayPhase, timing]);
  const countdownLabel =
    countdownParts !== null ? formatBookingSessionCountdownLabel(countdownParts) : null;
  const hasMeetingUrl = booking.meetingUrl !== null && booking.meetingUrl.trim().length > 0;
  const canShowJoin =
    !sessionEndedByFathom && booking.status === 'confirmed' && hasMeetingUrl && timing !== null && timing.canJoin;
  const executeJoinMeeting = useCallback((): void => {
    if (!hasMeetingUrl || booking.meetingUrl === null) {
      return;
    }
    const opened = openMeetingWindow(booking.meetingUrl);
    props.onPopupBlockedChange(opened === null);
  }, [booking.meetingUrl, hasMeetingUrl, props]);
  const calendarDescription = `Booking reference ${booking.bookingReference}. ${PROJECT_RESCUE_SERVICE_TAGLINE}`;
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <section
        className={cn(
          sessionCardClass,
          'overflow-hidden p-0',
          displayPhase === 'live' && 'ring-2 ring-emerald-500/40',
          displayPhase === 'starting-soon' && 'ring-2 ring-amber-500/30',
        )}
        aria-labelledby="session-room-heading"
      >
        <div className="border-b border-border/60 bg-linear-to-br from-primary/8 via-transparent to-transparent px-6 py-8 text-center md:px-8">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Badge variant="outline" className="border-primary/20 bg-background/80 text-xs uppercase tracking-wide">
              Session room
            </Badge>
            {timing !== null || sessionEndedByFathom ? (
              <Badge className={resolvePhaseBadgeClassName(displayPhase)}>{resolvePhaseLabel(displayPhase)}</Badge>
            ) : null}
          </div>
          <h2 id="session-room-heading" className="mt-4 text-balance text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
            {serviceTitle}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">Hi {booking.customerName.split(' ')[0] ?? booking.customerName}, your consultation is almost ready.</p>
          {booking.status === 'pending' ? (
            <div className="mx-auto mt-6 max-w-md rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-100">
              This booking is not confirmed yet. Complete payment from{' '}
              <Link href="/book/manage" className="font-semibold underline-offset-4 hover:underline">
                manage booking
              </Link>{' '}
              before your session.
            </div>
          ) : sessionEndedByFathom ? (
            <div className="mx-auto mt-6 max-w-md space-y-3">
              <p className="text-sm text-muted-foreground">Your consultation has ended. Thank you for joining TechMD.</p>
              {booking.fathomNotesUrl !== null ? (
                <p className="text-sm">
                  <a
                    href={booking.fathomNotesUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-primary underline-offset-4 hover:underline"
                  >
                    View meeting notes
                  </a>
                </p>
              ) : null}
            </div>
          ) : displayPhase === 'ended' ? (
            <p className="mt-6 text-sm text-muted-foreground">This session window has ended. Thank you for joining TechMD.</p>
          ) : displayPhase === 'live' ? (
            <div className="mt-6 space-y-2">
              <p className="text-lg font-semibold text-emerald-700 dark:text-emerald-300">Your session is in progress</p>
              <p className="text-sm text-muted-foreground">Join now if you have not already.</p>
            </div>
          ) : countdownLabel !== null ? (
            <div className="mt-6">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Starts in</p>
              <p
                className="mt-2 font-mono text-4xl font-semibold tracking-tight text-foreground tabular-nums md:text-5xl"
                aria-live="polite"
              >
                {countdownLabel}
              </p>
            </div>
          ) : (
            <div className="mt-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Syncing session clock…
            </div>
          )}
        </div>
        <div className="space-y-5 px-6 py-6 md:px-8">
          {booking.status === 'confirmed' && !sessionEndedByFathom ? (
            <Button
              type="button"
              size="lg"
              className="w-full gap-2"
              disabled={!canShowJoin}
              onClick={executeJoinMeeting}
            >
              <Video className="size-5" aria-hidden />
              {canShowJoin ? 'Join video call' : 'Join opens 10 min before start'}
            </Button>
          ) : null}
          {props.popupBlocked ? (
            <div
              className="flex gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-100"
              role="status"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
              <p>Your browser blocked the meeting popup. Allow popups for this site and try again.</p>
            </div>
          ) : null}
          {!hasMeetingUrl && booking.status === 'confirmed' ? (
            <div className="flex gap-3 rounded-xl border border-border/80 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
              <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin" aria-hidden />
              <p>Your video link is being prepared. Check your confirmation email in a few minutes, or refresh this page.</p>
            </div>
          ) : null}
          <SessionPrepChecklist />
        </div>
      </section>
      <section className={cn(sessionCardClass, 'p-4 md:p-6')} aria-labelledby="session-details-heading">
        <h3 id="session-details-heading" className="text-sm font-semibold text-foreground">
          Session details
        </h3>
        <dl className="mt-4 space-y-4 text-sm">
          <div className="flex gap-3">
            <CalendarClock className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
            <div>
              <dt className="text-xs font-medium text-muted-foreground">When</dt>
              <dd className="mt-1 font-medium text-foreground">{slotDisplay.date}</dd>
              <dd className="font-medium text-foreground">{slotDisplay.time}</dd>
              <dd className="text-xs text-muted-foreground">{booking.timezone}</dd>
              {booking.status === 'confirmed' ? (
                <AddToCalendarButtons
                  className="mt-3"
                  startsAtIso={booking.startsAtIso}
                  title={`${serviceTitle} · TechMD`}
                  description={calendarDescription}
                  location={resolveBookingJoinCalendarLocation({
                    useSessionRoomLinks: props.bookingSessionRoomLinksEnabled,
                    bookingReference: booking.bookingReference,
                    meetingUrl: booking.meetingUrl,
                  })}
                  icsUidSeed={booking.bookingReference}
                />
              ) : null}
            </div>
          </div>
          <div className="flex gap-3 border-t border-border/60 pt-4">
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
            <div>
              <dt className="text-xs font-medium text-muted-foreground">Booking reference</dt>
              <dd className="mt-1 font-mono text-base font-semibold tracking-wider text-foreground">{booking.bookingReference}</dd>
            </div>
          </div>
        </dl>
      </section>
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
        <Link href="/book/manage" className="font-medium text-primary underline-offset-4 hover:underline">
          Manage booking
        </Link>
        <button type="button" className="underline-offset-4 hover:underline" onClick={props.onLeaveRoom}>
          Use a different booking
        </button>
      </div>
    </div>
  );
}

function SessionPrepChecklist(): ReactElement {
  const items = [
    { icon: Wifi, label: 'Stable internet connection' },
    { icon: Headphones, label: 'Headphones recommended for clearer audio' },
    { icon: Mic, label: 'Allow camera and microphone when prompted' },
    { icon: Monitor, label: 'Join from a quiet space with your screen ready to share if needed' },
  ] as const;
  return (
    <div className="rounded-xl border border-border/60 bg-muted/20 px-4 py-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Before you join</p>
      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li key={item.label} className="flex items-start gap-2 text-sm text-foreground">
            <item.icon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
            <span>{item.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

type SessionFieldProps = {
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

function SessionField(props: SessionFieldProps): ReactElement {
  return (
    <div className="space-y-2">
      <label htmlFor={props.id} className="text-sm font-medium text-foreground">
        {props.label}
      </label>
      <Input
        id={props.id}
        type={props.type ?? 'text'}
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        placeholder={props.placeholder}
        autoComplete={props.autoComplete}
        inputMode={props.inputMode}
        maxLength={props.maxLength}
        className={props.className}
      />
      {props.helperText !== undefined ? <p className="text-xs text-muted-foreground">{props.helperText}</p> : null}
    </div>
  );
}
