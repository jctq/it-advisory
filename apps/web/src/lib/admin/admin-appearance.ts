export const ADMIN_COLOR_MODE_STORAGE_KEY = 'it-advisory-admin-color-mode';
export const ADMIN_COLOR_THEME_STORAGE_KEY = 'it-advisory-admin-color-theme';

export const ADMIN_COLOR_MODES = ['light', 'dark', 'system'] as const;
export const ADMIN_COLOR_THEMES = ['indigo', 'emerald', 'amber', 'rose'] as const;

export type AdminColorMode = (typeof ADMIN_COLOR_MODES)[number];
export type AdminColorTheme = (typeof ADMIN_COLOR_THEMES)[number];

export const DEFAULT_ADMIN_COLOR_MODE: AdminColorMode = 'system';
export const DEFAULT_ADMIN_COLOR_THEME: AdminColorTheme = 'indigo';

export type AdminColorModeOption = {
  readonly value: AdminColorMode;
  readonly label: string;
};

export type AdminColorThemeOption = {
  readonly value: AdminColorTheme;
  readonly label: string;
};

export const ADMIN_COLOR_MODE_OPTIONS: readonly AdminColorModeOption[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
] as const;

export const ADMIN_COLOR_THEME_OPTIONS: readonly AdminColorThemeOption[] = [
  { value: 'indigo', label: 'Indigo' },
  { value: 'emerald', label: 'Emerald' },
  { value: 'amber', label: 'Amber' },
  { value: 'rose', label: 'Rose' },
] as const;

export function isAdminColorMode(value: string | null): value is AdminColorMode {
  return value !== null && ADMIN_COLOR_MODES.includes(value as AdminColorMode);
}

export function isAdminColorTheme(value: string | null): value is AdminColorTheme {
  return value !== null && ADMIN_COLOR_THEMES.includes(value as AdminColorTheme);
}

export function resolveAdminColorMode(value: string | null): AdminColorMode {
  return isAdminColorMode(value) ? value : DEFAULT_ADMIN_COLOR_MODE;
}

export function resolveAdminColorTheme(value: string | null): AdminColorTheme {
  return isAdminColorTheme(value) ? value : DEFAULT_ADMIN_COLOR_THEME;
}
