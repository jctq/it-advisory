import AsyncStorage from '@react-native-async-storage/async-storage';

const ONBOARDING_COMPLETE_KEY = '@techmd/native/onboarding_complete' as const;

/**
 * Returns whether the user finished the first-run intro (persists until app data is cleared).
 */
export async function hasCompletedOnboarding(): Promise<boolean> {
  const value = await AsyncStorage.getItem(ONBOARDING_COMPLETE_KEY);
  return value === 'true';
}

/**
 * Marks onboarding as finished so the intro flow is skipped on next launch.
 */
export async function setOnboardingComplete(): Promise<void> {
  await AsyncStorage.setItem(ONBOARDING_COMPLETE_KEY, 'true');
}
