export const GA_MEASUREMENT_ID_ENV_NAME = 'NEXT_PUBLIC_GA_MEASUREMENT_ID';
const GA_LOG_PREFIX = '[TechMD Analytics]';

export function resolveGoogleAnalyticsMeasurementId(): string | null {
  const raw = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim();
  if (raw === undefined || raw.length === 0) {
    return null;
  }
  return raw;
}

export function isValidGaMeasurementId(measurementId: string): boolean {
  return /^G-[A-Z0-9]+$/i.test(measurementId);
}

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    google_tag_data?: Record<string, unknown>;
    __techmdGtagConsentDefaultApplied?: boolean;
    __techmdGaTransportDiagnosticsInstalled?: boolean;
  }
}

let gaActivationInFlight: Promise<void> | null = null;
let gaActivatedMeasurementId: string | null = null;

function logAnalyticsEvent(message: string, payload?: unknown): void {
  if (payload === undefined) {
    console.info(`${GA_LOG_PREFIX} ${message}`);
    return;
  }
  console.info(`${GA_LOG_PREFIX} ${message}`, payload);
}

function isGoogleAnalyticsEndpoint(url: string): boolean {
  return /google-analytics\.com|googletagmanager\.com|analytics\.google\.com/i.test(url);
}

function logDataLayerSnapshot(label: string): void {
  const length = window.dataLayer?.length ?? 0;
  const tail = window.dataLayer?.slice(Math.max(0, length - 8)) ?? [];
  logAnalyticsEvent(label, { length, tail });
}

function logGtagRuntimeState(label: string, measurementId: string): void {
  const gtagSource = typeof window.gtag === 'function' ? String(window.gtag).slice(0, 120) : typeof window.gtag;
  logAnalyticsEvent(label, {
    measurementId,
    gtagType: typeof window.gtag,
    gtagSourcePreview: gtagSource,
    hasGoogleTagData: window.google_tag_data !== undefined,
  });
}

function verifyAnalyticsTransport(measurementId: string): void {
  window.setTimeout(() => {
    const resourceEntries = performance
      .getEntriesByType('resource')
      .filter((entry) => isGoogleAnalyticsEndpoint(entry.name));
    logAnalyticsEvent('Transport verification (performance entries)', {
      measurementId,
      resourceCount: resourceEntries.length,
      resources: resourceEntries.map((entry) => entry.name),
    });
    if (resourceEntries.length === 0) {
      logAnalyticsEvent('No GA network resources detected after activation', { measurementId });
    }
  }, 2500);
}

function sendDirectCollectProbe(measurementId: string): void {
  const probeUrl = new URL('https://www.google-analytics.com/g/collect');
  probeUrl.searchParams.set('v', '2');
  probeUrl.searchParams.set('tid', measurementId);
  probeUrl.searchParams.set('en', 'techmd_direct_probe');
  probeUrl.searchParams.set('dl', window.location.href);
  probeUrl.searchParams.set('_et', '1');
  const probeResult = navigator.sendBeacon(probeUrl.toString());
  logAnalyticsEvent('Sent direct collect probe via sendBeacon', {
    measurementId,
    probeResult,
    probeUrl: probeUrl.toString(),
  });
}

function installTransportDiagnostics(): void {
  if (typeof window === 'undefined' || window.__techmdGaTransportDiagnosticsInstalled === true) {
    return;
  }
  const originalSendBeacon = navigator.sendBeacon.bind(navigator);
  navigator.sendBeacon = function sendBeacon(url: string | URL, data?: BodyInit | null): boolean {
    const resolvedUrl = String(url);
    if (isGoogleAnalyticsEndpoint(resolvedUrl)) {
      const payloadSize = typeof data === 'string' ? data.length : data === null || data === undefined ? 0 : -1;
      logAnalyticsEvent('sendBeacon called', { url: resolvedUrl, payloadSize });
    }
    const result = originalSendBeacon(url, data);
    if (isGoogleAnalyticsEndpoint(resolvedUrl)) {
      logAnalyticsEvent('sendBeacon result', { url: resolvedUrl, result });
    }
    return result;
  };
  const originalFetch = window.fetch.bind(window);
  window.fetch = async function fetchWithGaDiagnostics(
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    const requestUrl = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const isTracked = isGoogleAnalyticsEndpoint(requestUrl);
    if (isTracked) {
      logAnalyticsEvent('fetch called', { url: requestUrl, method: init?.method ?? 'GET' });
    }
    try {
      const response = await originalFetch(input, init);
      if (isTracked) {
        logAnalyticsEvent('fetch response', { url: requestUrl, status: response.status, ok: response.ok });
      }
      return response;
    } catch (error) {
      if (isTracked) {
        logAnalyticsEvent('fetch error', { url: requestUrl, error });
      }
      throw error;
    }
  };
  const originalXhrOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function openWithGaDiagnostics(
    method: string,
    url: string | URL,
    async?: boolean,
    username?: string | null,
    password?: string | null,
  ): void {
    const resolvedUrl = String(url);
    const isTracked = isGoogleAnalyticsEndpoint(resolvedUrl);
    if (isTracked) {
      logAnalyticsEvent('xhr open', { method, url: resolvedUrl });
      this.addEventListener('loadend', () => {
        logAnalyticsEvent('xhr loadend', { url: resolvedUrl, status: this.status });
      });
      this.addEventListener('error', () => {
        logAnalyticsEvent('xhr error', { url: resolvedUrl });
      });
    }
    originalXhrOpen.call(this, method, resolvedUrl, async ?? true, username ?? null, password ?? null);
  };
  window.addEventListener('securitypolicyviolation', (event: SecurityPolicyViolationEvent) => {
    if (isGoogleAnalyticsEndpoint(event.blockedURI)) {
      logAnalyticsEvent('CSP blocked analytics request', {
        blockedUri: event.blockedURI,
        violatedDirective: event.violatedDirective,
        effectiveDirective: event.effectiveDirective,
        sourceFile: event.sourceFile,
        lineNumber: event.lineNumber,
      });
    }
  });
  const originalImageSrcDescriptor = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
  if (originalImageSrcDescriptor !== undefined) {
    Object.defineProperty(HTMLImageElement.prototype, 'src', {
      configurable: true,
      enumerable: originalImageSrcDescriptor.enumerable ?? true,
      get: originalImageSrcDescriptor.get,
      set(value: string) {
        if (isGoogleAnalyticsEndpoint(String(value))) {
          logAnalyticsEvent('Image beacon src set', { url: String(value) });
        }
        originalImageSrcDescriptor.set?.call(this, value);
      },
    });
  }
  window.__techmdGaTransportDiagnosticsInstalled = true;
  logAnalyticsEvent('Installed transport diagnostics');
}

export function ensureGtagConsentDefaults(): void {
  if (typeof window === 'undefined') {
    return;
  }
  installTransportDiagnostics();
  window.dataLayer = window.dataLayer ?? [];
  if (typeof window.gtag !== 'function') {
    window.gtag = function gtag(...args: unknown[]): void {
      window.dataLayer?.push(args);
    };
  }
  if (window.__techmdGtagConsentDefaultApplied === true) {
    return;
  }
  window.gtag('consent', 'default', {
    analytics_storage: 'denied',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    functionality_storage: 'granted',
    security_storage: 'granted',
    wait_for_update: 500,
  });
  window.__techmdGtagConsentDefaultApplied = true;
  logAnalyticsEvent('Applied consent default (analytics denied)');
}

export function updateGtagAnalyticsConsent(granted: boolean): void {
  ensureGtagConsentDefaults();
  const consentState = granted ? 'granted' : 'denied';
  window.gtag?.('consent', 'update', {
    analytics_storage: consentState,
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
  });
  if (!granted) {
    gaActivatedMeasurementId = null;
  }
  logAnalyticsEvent('Updated analytics consent', { analytics_storage: consentState });
}

export function configureGoogleAnalytics(measurementId: string): void {
  ensureGtagConsentDefaults();
  const pagePath = window.location.pathname;
  const pageLocation = window.location.href;
  const pageTitle = document.title;
  const debugTimestamp = Date.now();
  logGtagRuntimeState('Before gtag config', measurementId);
  logDataLayerSnapshot('DataLayer before gtag config');
  window.gtag?.('config', measurementId, {
    anonymize_ip: true,
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
    send_page_view: true,
    debug_mode: true,
  });
  window.gtag?.('event', 'techmd_debug_ping', {
    page_location: pageLocation,
    page_path: pagePath,
    page_title: pageTitle,
    debug_mode: true,
    non_interaction: true,
    debug_timestamp: debugTimestamp,
  });
  logGtagRuntimeState('After gtag config', measurementId);
  logDataLayerSnapshot('DataLayer after gtag config');
  logAnalyticsEvent('Configured gtag and dispatched events', {
    measurementId,
    pagePath,
    debugTimestamp,
  });
  sendDirectCollectProbe(measurementId);
  verifyAnalyticsTransport(measurementId);
}

let gaScriptLoading: Promise<void> | null = null;

export function loadGoogleAnalyticsScript(measurementId: string): Promise<void> {
  if (typeof document === 'undefined') {
    return Promise.resolve();
  }
  const existing = document.querySelector<HTMLScriptElement>(`script[data-techmd-ga="${measurementId}"]`);
  if (existing !== null) {
    logAnalyticsEvent('GA script already present', { measurementId });
    return Promise.resolve();
  }
  if (gaScriptLoading !== null) {
    return gaScriptLoading;
  }
  gaScriptLoading = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
    script.dataset.techmdGa = measurementId;
    script.onload = () => {
      logAnalyticsEvent('Loaded GA script', { measurementId });
      resolve();
    };
    script.onerror = () => {
      gaScriptLoading = null;
      logAnalyticsEvent('Failed to load GA script', { measurementId });
      reject(new Error('Failed to load Google Analytics script'));
    };
    document.head.appendChild(script);
    logAnalyticsEvent('Appended GA script to document head', { measurementId });
  });
  return gaScriptLoading;
}

export async function activateGoogleAnalytics(measurementId: string): Promise<void> {
  if (!isValidGaMeasurementId(measurementId)) {
    logAnalyticsEvent('Skipped analytics activation due to invalid measurement id', { measurementId });
    return;
  }
  if (gaActivatedMeasurementId === measurementId) {
    logAnalyticsEvent('Analytics already activated for measurement id', { measurementId });
    return;
  }
  if (gaActivationInFlight !== null) {
    logAnalyticsEvent('Analytics activation already in flight, waiting', { measurementId });
    await gaActivationInFlight;
    return;
  }
  gaActivationInFlight = (async () => {
    logAnalyticsEvent('Starting analytics activation', { measurementId });
    ensureGtagConsentDefaults();
    await loadGoogleAnalyticsScript(measurementId);
    updateGtagAnalyticsConsent(true);
    await new Promise<void>((resolve) => {
      window.setTimeout(resolve, 100);
    });
    configureGoogleAnalytics(measurementId);
    gaActivatedMeasurementId = measurementId;
    logAnalyticsEvent('Analytics activation complete', { measurementId });
  })();
  try {
    await gaActivationInFlight;
  } finally {
    gaActivationInFlight = null;
  }
}
