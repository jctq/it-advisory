import { Redirect, useRootNavigationState } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { hasCompletedOnboarding } from '../src/lib/onboarding-storage';
import { useAppTheme } from '../src/theme/use-app-theme';

/**
 * Entry gate: first launch shows onboarding; later launches go straight to tabs.
 */
export default function IndexGateScreen() {
  const theme = useAppTheme();
  const rootNavigation = useRootNavigationState();
  const [isComplete, setIsComplete] = useState<boolean | null>(null);
  useEffect(() => {
    void hasCompletedOnboarding().then(setIsComplete);
  }, []);
  if (!rootNavigation?.key || isComplete === null) {
    return (
      <View style={[styles.boot, { backgroundColor: theme.background }]}>
        <ActivityIndicator color={theme.primary} size="large" />
      </View>
    );
  }
  if (!isComplete) {
    return <Redirect href="/onboarding" />;
  }
  return <Redirect href="/(tabs)" />;
}

const styles = StyleSheet.create({
  boot: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
});
