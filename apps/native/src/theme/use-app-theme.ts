import { useColorScheme } from 'react-native';

const LIGHT_THEME = {
  background: '#F5F7FC',
  surface: '#FFFFFF',
  surfaceMuted: '#EEF2FF',
  text: '#0F172A',
  textMuted: '#475569',
  textSoft: '#64748B',
  border: '#D6DFF5',
  primary: '#2843C4',
  primaryPressed: '#1E36A6',
  primarySoft: '#DEE6FF',
  success: '#0F9D58',
  danger: '#C2410C',
} as const;

const DARK_THEME = {
  background: '#0B1020',
  surface: '#121A2F',
  surfaceMuted: '#18233F',
  text: '#F8FAFC',
  textMuted: '#CBD5E1',
  textSoft: '#94A3B8',
  border: '#22304F',
  primary: '#8EA7FF',
  primaryPressed: '#6E89F3',
  primarySoft: '#1C2A57',
  success: '#4ADE80',
  danger: '#FB923C',
} as const;

/**
 * Returns the semantic native color palette for the current system theme.
 */
export function useAppTheme() {
  const colorScheme = useColorScheme();
  return colorScheme === 'dark' ? DARK_THEME : LIGHT_THEME;
}
