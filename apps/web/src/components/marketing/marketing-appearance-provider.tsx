'use client';

import type { ReactElement, ReactNode } from 'react';
import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useState,
  useSyncExternalStore,
} from 'react';
import {
  MARKETING_COLOR_MODE_STORAGE_KEY,
  MARKETING_COLOR_THEME_STORAGE_KEY,
  type AdminColorMode,
  type AdminColorTheme,
} from '@/lib/admin/admin-appearance';
import {
  applyDocumentAppearance,
  resolveClientMarketingAppearanceMode,
  resolveClientMarketingAppearanceTheme,
  resolveClientSystemPrefersDark,
  resolveServerMarketingAppearanceMode,
  resolveServerMarketingAppearanceTheme,
  resolveServerSystemPrefersDark,
  subscribeToMarketingAppearanceStorage,
  subscribeToSystemColorScheme,
} from '@/lib/admin/document-appearance';

type MarketingAppearanceContextValue = {
  readonly colorMode: AdminColorMode;
  readonly colorTheme: AdminColorTheme;
  readonly isDark: boolean;
  readonly executeChangeColorMode: (mode: AdminColorMode) => void;
  readonly executeChangeColorTheme: (theme: AdminColorTheme) => void;
};

const MarketingAppearanceContext = createContext<MarketingAppearanceContextValue | null>(null);

type MarketingAppearanceProviderProps = {
  readonly children: ReactNode;
};

/**
 * Applies marketing-site appearance (separate localStorage from admin; default light mode).
 */
export function MarketingAppearanceProvider(props: MarketingAppearanceProviderProps): ReactElement {
  const [colorModeOverride, setColorModeOverride] = useState<AdminColorMode | null>(null);
  const [colorThemeOverride, setColorThemeOverride] = useState<AdminColorTheme | null>(null);
  const storedColorMode = useSyncExternalStore(
    subscribeToMarketingAppearanceStorage,
    resolveClientMarketingAppearanceMode,
    resolveServerMarketingAppearanceMode,
  );
  const storedColorTheme = useSyncExternalStore(
    subscribeToMarketingAppearanceStorage,
    resolveClientMarketingAppearanceTheme,
    resolveServerMarketingAppearanceTheme,
  );
  const systemPrefersDark = useSyncExternalStore(
    subscribeToSystemColorScheme,
    resolveClientSystemPrefersDark,
    resolveServerSystemPrefersDark,
  );
  const colorMode = colorModeOverride ?? storedColorMode;
  const colorTheme = colorThemeOverride ?? storedColorTheme;
  const isDark = colorMode === 'dark' || (colorMode === 'system' && systemPrefersDark);
  useLayoutEffect(() => {
    applyDocumentAppearance({ colorTheme, isDark });
  }, [colorTheme, isDark]);
  const executeChangeColorMode = useCallback(
    (nextColorMode: AdminColorMode): void => {
      const nextIsDark = nextColorMode === 'dark' || (nextColorMode === 'system' && systemPrefersDark);
      window.localStorage.setItem(MARKETING_COLOR_MODE_STORAGE_KEY, nextColorMode);
      setColorModeOverride(nextColorMode);
      applyDocumentAppearance({ colorTheme, isDark: nextIsDark });
    },
    [colorTheme, systemPrefersDark],
  );
  const executeChangeColorTheme = useCallback(
    (nextColorTheme: AdminColorTheme): void => {
      window.localStorage.setItem(MARKETING_COLOR_THEME_STORAGE_KEY, nextColorTheme);
      setColorThemeOverride(nextColorTheme);
      applyDocumentAppearance({ colorTheme: nextColorTheme, isDark });
    },
    [isDark],
  );
  const value: MarketingAppearanceContextValue = {
    colorMode,
    colorTheme,
    isDark,
    executeChangeColorMode,
    executeChangeColorTheme,
  };
  return <MarketingAppearanceContext.Provider value={value}>{props.children}</MarketingAppearanceContext.Provider>;
}

export function useMarketingAppearance(): MarketingAppearanceContextValue {
  const context = useContext(MarketingAppearanceContext);
  if (context === null) {
    throw new Error('useMarketingAppearance must be used within MarketingAppearanceProvider');
  }
  return context;
}
