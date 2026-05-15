import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  useFonts,
} from '@expo-google-fonts/plus-jakarta-sans';
import type { PropsWithChildren, ReactNode } from 'react';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { useAppTheme } from '../theme/use-app-theme';

export type AppTypography = {
  readonly bold: string | undefined;
  readonly medium: string | undefined;
  readonly regular: string | undefined;
  readonly semibold: string | undefined;
};

const AppTypographyContext = createContext<AppTypography | null>(null);

/**
 * Returns loaded Plus Jakarta Sans family names for use on Text styles.
 */
export function useAppTypography(): AppTypography {
  const context = useContext(AppTypographyContext);
  if (context === null) {
    throw new Error('useAppTypography must be used within AppTypographyProvider.');
  }
  return context;
}

type AppTypographyProviderProps = PropsWithChildren<{
  readonly fallback?: ReactNode;
}>;

/**
 * Loads app fonts, coordinates splash screen hide, and exposes typography tokens.
 */
export function AppTypographyProvider(props: AppTypographyProviderProps) {
  const theme = useAppTheme();
  const [splashReady, setSplashReady] = useState<boolean>(false);
  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
  });
  useEffect(() => {
    void SplashScreen.preventAutoHideAsync();
  }, []);
  useEffect(() => {
    if (!fontsLoaded && fontError === null) {
      return;
    }
    setSplashReady(true);
    void SplashScreen.hideAsync();
  }, [fontError, fontsLoaded]);
  const typography = useMemo<AppTypography>(() => {
    const hasFonts = fontsLoaded && fontError === null;
    return {
      regular: hasFonts ? 'PlusJakartaSans_400Regular' : undefined,
      medium: hasFonts ? 'PlusJakartaSans_500Medium' : undefined,
      semibold: hasFonts ? 'PlusJakartaSans_600SemiBold' : undefined,
      bold: hasFonts ? 'PlusJakartaSans_700Bold' : undefined,
    };
  }, [fontError, fontsLoaded]);
  if (!splashReady) {
    return (
      <View style={[styles.boot, { backgroundColor: theme.background }]}>
        {props.fallback ?? <ActivityIndicator color={theme.primary} size="large" />}
      </View>
    );
  }
  return <AppTypographyContext.Provider value={typography}>{props.children}</AppTypographyContext.Provider>;
}

const styles = StyleSheet.create({
  boot: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
});
