import { cookies, headers } from 'next/headers';
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
import {
  DOCUMENT_APPEARANCE_DARK_BACKGROUND,
  DOCUMENT_APPEARANCE_LIGHT_BACKGROUND,
  type DocumentAppearance,
} from '@/lib/admin/document-appearance';
import type { AppearanceScope } from '@/lib/brand/appearance-cookies';

const APPEARANCE_SCOPE_HEADER = 'x-teqmd-appearance-scope';

function resolveAppearanceScope(scopeHeader: string | null): AppearanceScope {
  return scopeHeader === 'admin' ? 'admin' : 'marketing';
}

function resolvePrefersDarkFromHeaders(headerList: Headers): boolean {
  const clientHint = headerList.get('sec-ch-prefers-color-scheme')?.trim().toLowerCase();
  if (clientHint === 'dark') {
    return true;
  }
  if (clientHint === 'light') {
    return false;
  }
  return false;
}

function resolveDocumentAppearanceFromSettings(input: {
  readonly scope: AppearanceScope;
  readonly mode: AdminColorMode;
  readonly theme: AdminColorTheme;
  readonly prefersDark: boolean;
}): DocumentAppearance {
  const isDark =
    input.mode === 'dark' || (input.mode === 'system' && input.prefersDark);
  return { isDark, colorTheme: input.theme };
}

export type ResolvedLayoutDocumentAppearance = DocumentAppearance & {
  readonly backgroundColor: string;
  readonly mode: AdminColorMode;
};

function resolveScopedDocumentAppearance(input: {
  readonly scope: AppearanceScope;
  readonly storedMode: string | null;
  readonly storedTheme: string | null;
  readonly prefersDark: boolean;
}): ResolvedLayoutDocumentAppearance {
  const mode =
    input.scope === 'admin'
      ? resolveAdminColorMode(input.storedMode)
      : resolveMarketingColorMode(input.storedMode);
  const theme =
    input.scope === 'admin'
      ? resolveAdminColorTheme(input.storedTheme)
      : resolveMarketingColorTheme(input.storedTheme);
  const appearance = resolveDocumentAppearanceFromSettings({
    scope: input.scope,
    mode,
    theme,
    prefersDark: input.prefersDark,
  });
  return {
    ...appearance,
    mode,
    backgroundColor: appearance.isDark
      ? DOCUMENT_APPEARANCE_DARK_BACKGROUND
      : DOCUMENT_APPEARANCE_LIGHT_BACKGROUND,
  };
}

/**
 * Resolves document appearance for the root layout from proxy scope + appearance cookies.
 */
export async function resolveRootLayoutDocumentAppearance(): Promise<
  DocumentAppearance & { readonly backgroundColor: string }
> {
  const headerList = await headers();
  const cookieStore = await cookies();
  const scope = resolveAppearanceScope(headerList.get(APPEARANCE_SCOPE_HEADER));
  const prefersDark = resolvePrefersDarkFromHeaders(headerList);
  const modeKey = scope === 'admin' ? ADMIN_COLOR_MODE_STORAGE_KEY : MARKETING_COLOR_MODE_STORAGE_KEY;
  const themeKey = scope === 'admin' ? ADMIN_COLOR_THEME_STORAGE_KEY : MARKETING_COLOR_THEME_STORAGE_KEY;
  const storedMode = cookieStore.get(modeKey)?.value ?? null;
  const storedTheme = cookieStore.get(themeKey)?.value ?? null;
  return resolveScopedDocumentAppearance({ scope, storedMode, storedTheme, prefersDark });
}

/**
 * Resolves admin document appearance from appearance cookies for admin layout SSR.
 */
export async function resolveAdminLayoutDocumentAppearance(): Promise<ResolvedLayoutDocumentAppearance> {
  const headerList = await headers();
  const cookieStore = await cookies();
  const prefersDark = resolvePrefersDarkFromHeaders(headerList);
  const storedMode = cookieStore.get(ADMIN_COLOR_MODE_STORAGE_KEY)?.value ?? null;
  const storedTheme = cookieStore.get(ADMIN_COLOR_THEME_STORAGE_KEY)?.value ?? null;
  return resolveScopedDocumentAppearance({
    scope: 'admin',
    storedMode,
    storedTheme,
    prefersDark,
  });
}
