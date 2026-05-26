export const GA_MEASUREMENT_ID_ENV_NAME = 'NEXT_PUBLIC_GA_MEASUREMENT_ID';

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
    dataLayer?: IArguments[];
    gtag?: Gtag;
    __techmdGtagConsentDefaultApplied?: boolean;
  }
}

type Gtag = {
  (...args: unknown[]): void;
  (command: 'js', date: Date): void;
  (command: 'config', measurementId: string, config?: Record<string, unknown>): void;
  (command: 'event', eventName: string, params?: Record<string, unknown>): void;
  (command: 'consent', action: 'default' | 'update', params: Record<string, unknown>): void;
};

let gaActivationInFlight: Promise<void> | null = null;
let gaActivatedMeasurementId: string | null = null;

function getGtag(): Gtag {
  installGtagStub();
  return window.gtag as Gtag;
}

function installGtagStub(): void {
  if (typeof window.gtag === 'function') {
    return;
  }
  window.gtag = function gtag(): void {
    window.dataLayer?.push(arguments);
  } as Gtag;
}

export function ensureGtagConsentDefaults(): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.dataLayer = window.dataLayer ?? [];
  installGtagStub();
  if (window.__techmdGtagConsentDefaultApplied === true) {
    return;
  }
  getGtag()('consent', 'default', {
    analytics_storage: 'denied',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    functionality_storage: 'granted',
    security_storage: 'granted',
    wait_for_update: 500,
  });
  window.__techmdGtagConsentDefaultApplied = true;
}

export function updateGtagAnalyticsConsent(granted: boolean): void {
  ensureGtagConsentDefaults();
  const consentState = granted ? 'granted' : 'denied';
  getGtag()('consent', 'update', {
    analytics_storage: consentState,
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
  });
  if (!granted) {
    gaActivatedMeasurementId = null;
  }
}

export function configureGoogleAnalytics(measurementId: string): void {
  ensureGtagConsentDefaults();
  const gtag = getGtag();
  gtag('js', new Date());
  gtag('config', measurementId, {
    anonymize_ip: true,
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
    send_page_view: true,
  });
}

let gaScriptLoading: Promise<void> | null = null;

export function loadGoogleAnalyticsScript(measurementId: string): Promise<void> {
  if (typeof document === 'undefined') {
    return Promise.resolve();
  }
  const existing = document.querySelector<HTMLScriptElement>(`script[data-techmd-ga="${measurementId}"]`);
  if (existing !== null) {
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
    script.onload = () => resolve();
    script.onerror = () => {
      gaScriptLoading = null;
      reject(new Error('Failed to load Google Analytics script'));
    };
    document.head.appendChild(script);
  });
  return gaScriptLoading;
}

export async function activateGoogleAnalytics(measurementId: string): Promise<void> {
  if (!isValidGaMeasurementId(measurementId)) {
    return;
  }
  if (gaActivatedMeasurementId === measurementId) {
    return;
  }
  if (gaActivationInFlight !== null) {
    await gaActivationInFlight;
    return;
  }
  gaActivationInFlight = (async () => {
    ensureGtagConsentDefaults();
    await loadGoogleAnalyticsScript(measurementId);
    updateGtagAnalyticsConsent(true);
    await new Promise<void>((resolve) => {
      window.setTimeout(resolve, 100);
    });
    configureGoogleAnalytics(measurementId);
    gaActivatedMeasurementId = measurementId;
  })();
  try {
    await gaActivationInFlight;
  } finally {
    gaActivationInFlight = null;
  }
}
