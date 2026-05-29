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
