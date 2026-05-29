export type SettingsTab =
  | 'general'
  | 'pricing'
  | 'payments'
  | 'email'
  | 'support'
  | 'meetings'
  | 'recordings';

const SETTINGS_TAB_VALUES: readonly SettingsTab[] = [
  'general',
  'pricing',
  'payments',
  'email',
  'support',
  'meetings',
  'recordings',
] as const;

export function resolveSettingsTab(value: string | undefined): SettingsTab {
  if (value !== undefined && SETTINGS_TAB_VALUES.includes(value as SettingsTab)) {
    return value as SettingsTab;
  }
  return 'general';
}
