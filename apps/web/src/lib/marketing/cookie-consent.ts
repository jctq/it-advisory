export const COOKIE_CONSENT_STORAGE_KEY = 'techmd-cookie-consent';

export const COOKIE_CONSENT_VERSION = 1 as const;

export type CookieConsentChoice = 'pending' | 'essential-only' | 'all';

export type CookieConsentRecord = {
  readonly version: typeof COOKIE_CONSENT_VERSION;
  readonly choice: Exclude<CookieConsentChoice, 'pending'>;
  readonly analytics: boolean;
  readonly savedAt: string;
};

export type CookieConsentDraft = {
  readonly analytics: boolean;
};

export function buildCookieConsentRecord(choice: Exclude<CookieConsentChoice, 'pending'>): CookieConsentRecord {
  return {
    version: COOKIE_CONSENT_VERSION,
    choice,
    analytics: choice === 'all',
    savedAt: new Date().toISOString(),
  };
}

export function parseCookieConsentRecord(raw: string | null): CookieConsentRecord | null {
  if (raw === null || raw.length === 0) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) {
      return null;
    }
    const record = parsed as Partial<CookieConsentRecord>;
    if (record.version !== COOKIE_CONSENT_VERSION) {
      return null;
    }
    if (record.choice !== 'essential-only' && record.choice !== 'all') {
      return null;
    }
    if (typeof record.analytics !== 'boolean') {
      return null;
    }
    if (typeof record.savedAt !== 'string' || record.savedAt.length === 0) {
      return null;
    }
    if (record.choice === 'all' && !record.analytics) {
      return null;
    }
    if (record.choice === 'essential-only' && record.analytics) {
      return null;
    }
    return {
      version: COOKIE_CONSENT_VERSION,
      choice: record.choice,
      analytics: record.analytics,
      savedAt: record.savedAt,
    };
  } catch {
    return null;
  }
}

let cachedConsentRaw: string | null | undefined;
let cachedConsentSnapshot: CookieConsentRecord | null = null;

/**
 * Stable snapshot for `useSyncExternalStore` — returns the same object reference until storage changes.
 */
export function getCookieConsentSnapshot(): CookieConsentRecord | null {
  if (typeof window === 'undefined') {
    return null;
  }
  const raw = window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY);
  if (raw === cachedConsentRaw) {
    return cachedConsentSnapshot;
  }
  cachedConsentRaw = raw;
  cachedConsentSnapshot = parseCookieConsentRecord(raw);
  return cachedConsentSnapshot;
}

export function readCookieConsentFromStorage(): CookieConsentRecord | null {
  return getCookieConsentSnapshot();
}

export const COOKIE_CONSENT_CHANGE_EVENT = 'techmd-cookie-consent-change';

export function writeCookieConsentToStorage(record: CookieConsentRecord): void {
  const serialized = JSON.stringify(record);
  window.localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, serialized);
  cachedConsentRaw = serialized;
  cachedConsentSnapshot = record;
  window.dispatchEvent(new Event(COOKIE_CONSENT_CHANGE_EVENT));
}

export function subscribeCookieConsent(onStoreChange: () => void): () => void {
  const handleStorage = (event: StorageEvent): void => {
    if (event.key === null || event.key === COOKIE_CONSENT_STORAGE_KEY) {
      onStoreChange();
    }
  };
  window.addEventListener('storage', handleStorage);
  window.addEventListener(COOKIE_CONSENT_CHANGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener('storage', handleStorage);
    window.removeEventListener(COOKIE_CONSENT_CHANGE_EVENT, onStoreChange);
  };
}

export function hasAnalyticsConsent(record: CookieConsentRecord | null): boolean {
  return record?.analytics === true;
}
