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
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

export function ensureGtagConsentDefaults(): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.dataLayer = window.dataLayer ?? [];
  if (typeof window.gtag !== 'function') {
    window.gtag = function gtag(...args: unknown[]): void {
      window.dataLayer?.push(args);
    };
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
}

export function updateGtagAnalyticsConsent(granted: boolean): void {
  ensureGtagConsentDefaults();
  window.gtag?.('consent', 'update', {
    analytics_storage: granted ? 'granted' : 'denied',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
  });
}

export function configureGoogleAnalytics(measurementId: string): void {
  ensureGtagConsentDefaults();
  window.gtag?.('js', new Date());
  window.gtag?.('config', measurementId, {
    anonymize_ip: true,
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
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
  updateGtagAnalyticsConsent(true);
  await loadGoogleAnalyticsScript(measurementId);
  configureGoogleAnalytics(measurementId);
}
