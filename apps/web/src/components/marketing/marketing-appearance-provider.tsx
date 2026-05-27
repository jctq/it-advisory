'use client';

import type { ReactElement, ReactNode } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { MarketingAppearanceStoreHydrator } from '@/components/marketing/marketing-appearance-store-hydrator';
import type { AdminColorMode, AdminColorTheme } from '@/lib/admin/admin-appearance';
import {
  selectMarketingAppearanceView,
  useMarketingAppearanceStore,
} from '@/store/marketing/marketing-appearance-store';

export type MarketingAppearanceContextValue = {
  readonly colorMode: AdminColorMode;
  readonly colorTheme: AdminColorTheme;
  readonly isDark: boolean;
  readonly executeChangeColorMode: (mode: AdminColorMode) => void;
  readonly executeChangeColorTheme: (theme: AdminColorTheme) => void;
};

type MarketingAppearanceProviderProps = {
  readonly children: ReactNode;
};

/**
 * Applies marketing-site appearance (separate localStorage from admin; default light mode).
 */
export function MarketingAppearanceProvider(props: MarketingAppearanceProviderProps): ReactElement {
  return (
    <MarketingAppearanceStoreHydrator>
      {props.children}
    </MarketingAppearanceStoreHydrator>
  );
}

export function useMarketingAppearance(): MarketingAppearanceContextValue {
  return useMarketingAppearanceStore(useShallow(selectMarketingAppearanceView));
}
