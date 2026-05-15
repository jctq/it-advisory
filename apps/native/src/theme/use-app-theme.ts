import { useColorScheme } from 'react-native';

const LIGHT_THEME = {
  background: '#F3F1FA',
  backgroundGradientEnd: '#E4DCF8',
  surface: '#FFFFFF',
  surfaceMuted: '#EEECF8',
  text: '#14122B',
  textMuted: '#4B4867',
  textSoft: '#6B6789',
  border: '#E2DEF0',
  primary: '#5B4FD6',
  primaryPressed: '#4A3FC0',
  primarySoft: '#E8E4FF',
  /** Bottom navigation shaped bar (light lavender tray, distinct from scene background). */
  tabBarFill: '#E8E2FB',
  onPrimary: '#FFFFFF',
  onPrimaryMuted: 'rgba(255,255,255,0.88)',
  success: '#0D9B5C',
  danger: '#C2410C',
} as const;

const DARK_THEME = {
  background: '#0E0C18',
  backgroundGradientEnd: '#16122C',
  surface: '#17152A',
  surfaceMuted: '#211E38',
  /** Tray surface: slightly lighter than app background for a clear “dock” read. */
  tabBarFill: '#1A1730',
  text: '#F7F5FF',
  textMuted: '#C4C0DC',
  textSoft: '#9C96B8',
  border: '#2E2A45',
  primary: '#9D92FF',
  primaryPressed: '#7F72F0',
  primarySoft: '#2A2648',
  onPrimary: '#0E0C18',
  onPrimaryMuted: 'rgba(14,12,24,0.82)',
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
