export type PublicBookingAvailabilitySlot = {
  readonly date: string;
  readonly time: string;
  readonly startsAtIso: string;
};

export type GetBookingAvailabilitySlotsParams = {
  readonly apiBaseUrl: string;
  readonly fromYmd: string;
  readonly toYmd: string;
  readonly serviceKey?: string;
  readonly signal?: AbortSignal;
};

/**
 * Fetches the public marketing availability allowlist from the Next.js backend.
 */
export async function getBookingAvailabilitySlots(
  params: GetBookingAvailabilitySlotsParams,
): Promise<readonly PublicBookingAvailabilitySlot[]> {
  const base = params.apiBaseUrl.replace(/\/$/, '');
  const serviceKey = params.serviceKey ?? 'project-rescue';
  const url = `${base}/api/booking/availability?serviceKey=${encodeURIComponent(serviceKey)}&from=${encodeURIComponent(params.fromYmd)}&to=${encodeURIComponent(params.toYmd)}`;
  const response = await fetch(url, { signal: params.signal, cache: 'no-store' });
  const payload = (await response.json()) as { slots?: PublicBookingAvailabilitySlot[]; error?: string };
  if (!response.ok) {
    throw new Error(typeof payload.error === 'string' ? payload.error : 'Failed to load availability');
  }
  return payload.slots ?? [];
}

function buildServerTimeUrl(apiBaseUrl: string): string {
  const base = apiBaseUrl.trim().replace(/\/$/, '');
  return base.length === 0 ? '/api/server-time' : `${base}/api/server-time`;
}

/**
 * Milliseconds to add to `Date.now()` so that `Date.now() + offset` approximates server UTC time
 * (uses the midpoint between request start and response received to reduce network skew).
 */
export function resolveServerClockOffsetMilliseconds(input: {
  readonly serverNowIso: string;
  readonly requestStartedAtMs: number;
  readonly responseReceivedAtMs: number;
}): number | null {
  const serverMs = Date.parse(input.serverNowIso);
  if (Number.isNaN(serverMs)) {
    return null;
  }
  const clientMidMs = (input.requestStartedAtMs + input.responseReceivedAtMs) / 2;
  return serverMs - clientMidMs;
}

export type FetchMarketingServerClockOffsetParams = {
  readonly apiBaseUrl: string;
  readonly signal?: AbortSignal;
};

/**
 * Fetches `GET /api/server-time` and returns an offset suitable for client-side "now" in booking UIs.
 */
export type RescheduleMarketingCheckoutSlotParams = {
  /** Full POST URL (preferred — same origin or `NEXT_PUBLIC_API_BASE_URL` origin). */
  readonly apiUrl?: string;
  /** Legacy: API origin only; omit when `apiUrl` is set. */
  readonly apiBaseUrl?: string;
  readonly sessionRef: string;
  readonly dateYmd: string;
  readonly timeLabel: string;
  readonly signal?: AbortSignal;
};

function resolveRescheduleMarketingCheckoutSlotUrl(params: RescheduleMarketingCheckoutSlotParams): string {
  const explicit = params.apiUrl?.trim() ?? '';
  if (explicit.length > 0) {
    return explicit;
  }
  const base = params.apiBaseUrl?.replace(/\/$/, '') ?? '';
  return base.length === 0
    ? '/api/bookings/checkout/reschedule-slot'
    : `${base}/api/bookings/checkout/reschedule-slot`;
}

async function readMarketingApiJsonPayload(
  response: Response,
): Promise<{ ok?: boolean; error?: string; code?: string }> {
  const text = await response.text();
  if (text.trim().length === 0) {
    if (!response.ok) {
      throw new Error(`Could not save your new session time. (${response.status})`);
    }
    return {};
  }
  try {
    return JSON.parse(text) as { ok?: boolean; error?: string; code?: string };
  } catch {
    throw new Error(
      response.ok
        ? 'Could not save your new session time.'
        : `Could not save your new session time. (${response.status})`,
    );
  }
}

/**
 * Persists a new slot on the diagnostic session's pending booking after an expired payment hold.
 */
export async function rescheduleMarketingCheckoutSlot(
  params: RescheduleMarketingCheckoutSlotParams,
): Promise<void> {
  const url = resolveRescheduleMarketingCheckoutSlotUrl(params);
  const response = await fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionRef: params.sessionRef,
      date: params.dateYmd,
      time: params.timeLabel,
    }),
    signal: params.signal,
  });
  const payload = await readMarketingApiJsonPayload(response);
  if (!response.ok || payload.ok !== true) {
    throw new Error(typeof payload.error === 'string' ? payload.error : 'Could not save your new session time.');
  }
}

export async function fetchMarketingServerClockOffsetMs(
  params: FetchMarketingServerClockOffsetParams,
): Promise<number | null> {
  const startedAtMs = Date.now();
  try {
    const url = buildServerTimeUrl(params.apiBaseUrl);
    const response = await fetch(url, { signal: params.signal, cache: 'no-store' });
    const receivedAtMs = Date.now();
    const payload = (await response.json()) as { nowIso?: string };
    if (!response.ok || typeof payload.nowIso !== 'string') {
      return null;
    }
    return resolveServerClockOffsetMilliseconds({
      serverNowIso: payload.nowIso,
      requestStartedAtMs: startedAtMs,
      responseReceivedAtMs: receivedAtMs,
    });
  } catch {
    return null;
  }
}
