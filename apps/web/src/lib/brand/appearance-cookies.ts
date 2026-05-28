import {
  ADMIN_COLOR_MODE_STORAGE_KEY,
  ADMIN_COLOR_THEME_STORAGE_KEY,
  MARKETING_COLOR_MODE_STORAGE_KEY,
  MARKETING_COLOR_THEME_STORAGE_KEY,
  resolveAdminColorMode,
  resolveAdminColorTheme,
  resolveMarketingColorMode,
  resolveMarketingColorTheme,
  type AdminColorMode,
  type AdminColorTheme,
} from '@/lib/admin/admin-appearance';

export type AppearanceScope = 'admin' | 'marketing';

const APPEARANCE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

function writeCookie(name: string, value: string): void {
  if (typeof document === 'undefined') {
    return;
  }
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${APPEARANCE_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`;
}

export function writeAppearanceCookies(scope: AppearanceScope, mode: AdminColorMode, theme: AdminColorTheme): void {
  const modeKey = scope === 'admin' ? ADMIN_COLOR_MODE_STORAGE_KEY : MARKETING_COLOR_MODE_STORAGE_KEY;
  const themeKey = scope === 'admin' ? ADMIN_COLOR_THEME_STORAGE_KEY : MARKETING_COLOR_THEME_STORAGE_KEY;
  writeCookie(modeKey, mode);
  writeCookie(themeKey, theme);
}

export function syncAppearanceCookiesFromLocalStorage(pathname: string): void {
  if (typeof window === 'undefined') {
    return;
  }
  const scope: AppearanceScope = pathname.startsWith('/admin') ? 'admin' : 'marketing';
  const modeKey = scope === 'admin' ? ADMIN_COLOR_MODE_STORAGE_KEY : MARKETING_COLOR_MODE_STORAGE_KEY;
  const themeKey = scope === 'admin' ? ADMIN_COLOR_THEME_STORAGE_KEY : MARKETING_COLOR_THEME_STORAGE_KEY;
  const modeRaw = window.localStorage.getItem(modeKey);
  const themeRaw = window.localStorage.getItem(themeKey);
  if (modeRaw === null && themeRaw === null) {
    return;
  }
  const mode =
    scope === 'admin' ? resolveAdminColorMode(modeRaw) : resolveMarketingColorMode(modeRaw);
  const theme =
    scope === 'admin' ? resolveAdminColorTheme(themeRaw) : resolveMarketingColorTheme(themeRaw);
  writeAppearanceCookies(scope, mode, theme);
}
