'use client';

import type { ReactElement, ReactNode } from 'react';
import { useLayoutEffect, useSyncExternalStore } from 'react';
import {
  resolveClientMarketingAppearanceMode,
  resolveClientMarketingAppearanceTheme,
  resolveClientSystemPrefersDark,
  resolveServerMarketingAppearanceMode,
  resolveServerMarketingAppearanceTheme,
  resolveServerSystemPrefersDark,
  subscribeToMarketingAppearanceStorage,
  subscribeToSystemColorScheme,
} from '@/lib/admin/document-appearance';
import { useMarketingAppearanceStore } from '@/store/marketing/marketing-appearance-store';

type MarketingAppearanceStoreHydratorProps = {
  readonly children: ReactNode;
};

/**
 * Syncs localStorage / system appearance into the marketing Zustand store and applies document theme.
 */
export function MarketingAppearanceStoreHydrator(props: MarketingAppearanceStoreHydratorProps): ReactElement {
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
  const syncExternalAppearance = useMarketingAppearanceStore((state) => state.syncExternalAppearance);
  const applyResolvedAppearance = useMarketingAppearanceStore((state) => state.applyResolvedAppearance);
  useLayoutEffect(() => {
    syncExternalAppearance({ storedColorMode, storedColorTheme, systemPrefersDark });
  }, [storedColorMode, storedColorTheme, systemPrefersDark, syncExternalAppearance]);
  useLayoutEffect(() => {
    applyResolvedAppearance();
  }, [storedColorMode, storedColorTheme, systemPrefersDark, applyResolvedAppearance]);
  return <>{props.children}</>;
}
