import {
  ADMIN_COLOR_MODE_STORAGE_KEY,
  ADMIN_COLOR_THEME_STORAGE_KEY,
  DEFAULT_ADMIN_COLOR_MODE,
  DEFAULT_ADMIN_COLOR_THEME,
  DEFAULT_MARKETING_COLOR_MODE,
  DEFAULT_MARKETING_COLOR_THEME,
  MARKETING_COLOR_MODE_STORAGE_KEY,
  MARKETING_COLOR_THEME_STORAGE_KEY,
  resolveAdminColorMode,
  resolveAdminColorTheme,
  resolveMarketingColorMode,
  resolveMarketingColorTheme,
  type AdminColorMode,
  type AdminColorTheme,
} from '@/lib/admin/admin-appearance';

export const DOCUMENT_APPEARANCE_DARK_BACKGROUND = '#0f172a';
export const DOCUMENT_APPEARANCE_LIGHT_BACKGROUND = '#ffffff';

export type DocumentAppearance = {
  readonly isDark: boolean;
  readonly colorTheme: AdminColorTheme;
};

/**
 * Applies light/dark classes and accent theme tokens on the root element for a flash-free shell.
 */
export function applyDocumentAppearance(params: DocumentAppearance): void {
  if (typeof document === 'undefined') {
    return;
  }
  const documentElement = document.documentElement;
  const backgroundColor = params.isDark
    ? DOCUMENT_APPEARANCE_DARK_BACKGROUND
    : DOCUMENT_APPEARANCE_LIGHT_BACKGROUND;
  documentElement.classList.toggle('dark', params.isDark);
  documentElement.style.colorScheme = params.isDark ? 'dark' : 'light';
  documentElement.style.backgroundColor = backgroundColor;
  documentElement.dataset.colorTheme = params.colorTheme;
}

/**
 * Resolves stored admin mode/theme and system preference into the active document appearance.
 */
export function resolveAdminDocumentAppearanceFromBrowser(): DocumentAppearance {
  if (typeof window === 'undefined') {
    return {
      isDark: false,
      colorTheme: DEFAULT_ADMIN_COLOR_THEME,
    };
  }
  const mode = resolveAdminColorMode(window.localStorage.getItem(ADMIN_COLOR_MODE_STORAGE_KEY));
  const colorTheme = resolveAdminColorTheme(window.localStorage.getItem(ADMIN_COLOR_THEME_STORAGE_KEY));
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = mode === 'dark' || (mode === 'system' && prefersDark);
  return { isDark, colorTheme };
}

/**
 * Resolves stored marketing mode/theme and system preference into the active document appearance.
 */
export function resolveMarketingDocumentAppearanceFromBrowser(): DocumentAppearance {
  if (typeof window === 'undefined') {
    return {
      isDark: false,
      colorTheme: DEFAULT_MARKETING_COLOR_THEME,
    };
  }
  const mode = resolveMarketingColorMode(window.localStorage.getItem(MARKETING_COLOR_MODE_STORAGE_KEY));
  const colorTheme = resolveMarketingColorTheme(
    window.localStorage.getItem(MARKETING_COLOR_THEME_STORAGE_KEY),
  );
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = mode === 'dark' || (mode === 'system' && prefersDark);
  return { isDark, colorTheme };
}

/**
 * Synchronizes the document root from admin appearance localStorage (and live system preference when mode is system).
 */
export function syncAdminDocumentAppearanceFromStorage(): void {
  applyDocumentAppearance(resolveAdminDocumentAppearanceFromBrowser());
}

/**
 * Synchronizes the document root from marketing appearance localStorage.
 */
export function syncMarketingDocumentAppearanceFromStorage(): void {
  applyDocumentAppearance(resolveMarketingDocumentAppearanceFromBrowser());
}

export function subscribeToAdminAppearanceStorage(onStoreChange: () => void): () => void {
  if (typeof window === 'undefined') {
    return () => undefined;
  }
  const executeHandleStorageChange = (event: StorageEvent): void => {
    if (
      event.key === null ||
      event.key === ADMIN_COLOR_MODE_STORAGE_KEY ||
      event.key === ADMIN_COLOR_THEME_STORAGE_KEY
    ) {
      onStoreChange();
    }
  };
  window.addEventListener('storage', executeHandleStorageChange);
  return () => {
    window.removeEventListener('storage', executeHandleStorageChange);
  };
}

export function subscribeToMarketingAppearanceStorage(onStoreChange: () => void): () => void {
  if (typeof window === 'undefined') {
    return () => undefined;
  }
  const executeHandleStorageChange = (event: StorageEvent): void => {
    if (
      event.key === null ||
      event.key === MARKETING_COLOR_MODE_STORAGE_KEY ||
      event.key === MARKETING_COLOR_THEME_STORAGE_KEY
    ) {
      onStoreChange();
    }
  };
  window.addEventListener('storage', executeHandleStorageChange);
  return () => {
    window.removeEventListener('storage', executeHandleStorageChange);
  };
}

export function subscribeToSystemColorScheme(onStoreChange: () => void): () => void {
  if (typeof window === 'undefined') {
    return () => undefined;
  }
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const executeHandleChange = (): void => {
    onStoreChange();
  };
  mediaQuery.addEventListener('change', executeHandleChange);
  return () => {
    mediaQuery.removeEventListener('change', executeHandleChange);
  };
}

export function resolveServerAdminAppearanceMode(): AdminColorMode {
  return DEFAULT_ADMIN_COLOR_MODE;
}

export function resolveClientAdminAppearanceMode(): AdminColorMode {
  if (typeof window === 'undefined') {
    return resolveServerAdminAppearanceMode();
  }
  return resolveAdminColorMode(window.localStorage.getItem(ADMIN_COLOR_MODE_STORAGE_KEY));
}

export function resolveServerAdminAppearanceTheme(): AdminColorTheme {
  return DEFAULT_ADMIN_COLOR_THEME;
}

export function resolveClientAdminAppearanceTheme(): AdminColorTheme {
  if (typeof window === 'undefined') {
    return resolveServerAdminAppearanceTheme();
  }
  return resolveAdminColorTheme(window.localStorage.getItem(ADMIN_COLOR_THEME_STORAGE_KEY));
}

export function resolveServerMarketingAppearanceMode(): AdminColorMode {
  return DEFAULT_MARKETING_COLOR_MODE;
}

export function resolveClientMarketingAppearanceMode(): AdminColorMode {
  if (typeof window === 'undefined') {
    return resolveServerMarketingAppearanceMode();
  }
  return resolveMarketingColorMode(window.localStorage.getItem(MARKETING_COLOR_MODE_STORAGE_KEY));
}

export function resolveServerMarketingAppearanceTheme(): AdminColorTheme {
  return DEFAULT_MARKETING_COLOR_THEME;
}

export function resolveClientMarketingAppearanceTheme(): AdminColorTheme {
  if (typeof window === 'undefined') {
    return resolveServerMarketingAppearanceTheme();
  }
  return resolveMarketingColorTheme(window.localStorage.getItem(MARKETING_COLOR_THEME_STORAGE_KEY));
}

export function resolveServerSystemPrefersDark(): boolean {
  return false;
}

export function resolveClientSystemPrefersDark(): boolean {
  if (typeof window === 'undefined') {
    return resolveServerSystemPrefersDark();
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}
