'use client';

import { create } from 'zustand';
import {
  MARKETING_COLOR_MODE_STORAGE_KEY,
  MARKETING_COLOR_THEME_STORAGE_KEY,
  type AdminColorMode,
  type AdminColorTheme,
} from '@/lib/admin/admin-appearance';
import { writeAppearanceCookies } from '@/lib/brand/appearance-cookies';
import {
  applyDocumentAppearance,
  resolveServerMarketingAppearanceMode,
  resolveServerMarketingAppearanceTheme,
} from '@/lib/admin/document-appearance';

export type MarketingAppearanceState = {
  readonly colorModeOverride: AdminColorMode | null;
  readonly colorThemeOverride: AdminColorTheme | null;
  readonly storedColorMode: AdminColorMode;
  readonly storedColorTheme: AdminColorTheme;
  readonly systemPrefersDark: boolean;
};

export type MarketingAppearanceActions = {
  readonly syncExternalAppearance: (params: {
    readonly storedColorMode: AdminColorMode;
    readonly storedColorTheme: AdminColorTheme;
    readonly systemPrefersDark: boolean;
  }) => void;
  readonly executeChangeColorMode: (mode: AdminColorMode) => void;
  readonly executeChangeColorTheme: (theme: AdminColorTheme) => void;
  readonly applyResolvedAppearance: () => void;
};

export type MarketingAppearanceStore = MarketingAppearanceState & MarketingAppearanceActions;

function resolveIsDark(params: {
  readonly colorMode: AdminColorMode;
  readonly systemPrefersDark: boolean;
}): boolean {
  return params.colorMode === 'dark' || (params.colorMode === 'system' && params.systemPrefersDark);
}

function resolveEffectiveAppearance(state: MarketingAppearanceState): {
  readonly colorMode: AdminColorMode;
  readonly colorTheme: AdminColorTheme;
  readonly isDark: boolean;
} {
  const colorMode = state.colorModeOverride ?? state.storedColorMode;
  const colorTheme = state.colorThemeOverride ?? state.storedColorTheme;
  const isDark = resolveIsDark({ colorMode, systemPrefersDark: state.systemPrefersDark });
  return { colorMode, colorTheme, isDark };
}

export const useMarketingAppearanceStore = create<MarketingAppearanceStore>((set, get) => ({
  colorModeOverride: null,
  colorThemeOverride: null,
  storedColorMode: resolveServerMarketingAppearanceMode(),
  storedColorTheme: resolveServerMarketingAppearanceTheme(),
  systemPrefersDark: false,
  syncExternalAppearance: (params): void => {
    set({
      storedColorMode: params.storedColorMode,
      storedColorTheme: params.storedColorTheme,
      systemPrefersDark: params.systemPrefersDark,
    });
    get().applyResolvedAppearance();
  },
  executeChangeColorMode: (nextColorMode): void => {
    const state = get();
    const colorTheme = state.colorThemeOverride ?? state.storedColorTheme;
    const nextIsDark = resolveIsDark({ colorMode: nextColorMode, systemPrefersDark: state.systemPrefersDark });
    window.localStorage.setItem(MARKETING_COLOR_MODE_STORAGE_KEY, nextColorMode);
    writeAppearanceCookies('marketing', nextColorMode, colorTheme);
    set({ colorModeOverride: nextColorMode });
    applyDocumentAppearance({ colorTheme, isDark: nextIsDark });
  },
  executeChangeColorTheme: (nextColorTheme): void => {
    const state = get();
    const colorMode = state.colorModeOverride ?? state.storedColorMode;
    const isDark = resolveIsDark({ colorMode, systemPrefersDark: state.systemPrefersDark });
    window.localStorage.setItem(MARKETING_COLOR_THEME_STORAGE_KEY, nextColorTheme);
    writeAppearanceCookies('marketing', colorMode, nextColorTheme);
    set({ colorThemeOverride: nextColorTheme });
    applyDocumentAppearance({ colorTheme: nextColorTheme, isDark });
  },
  applyResolvedAppearance: (): void => {
    const { colorMode, colorTheme, isDark } = resolveEffectiveAppearance(get());
    writeAppearanceCookies('marketing', colorMode, colorTheme);
    applyDocumentAppearance({ colorTheme, isDark });
  },
}));

export function selectMarketingAppearanceView(state: MarketingAppearanceStore): {
  readonly colorMode: AdminColorMode;
  readonly colorTheme: AdminColorTheme;
  readonly isDark: boolean;
  readonly executeChangeColorMode: (mode: AdminColorMode) => void;
  readonly executeChangeColorTheme: (theme: AdminColorTheme) => void;
} {
  const resolved = resolveEffectiveAppearance(state);
  return {
    colorMode: resolved.colorMode,
    colorTheme: resolved.colorTheme,
    isDark: resolved.isDark,
    executeChangeColorMode: state.executeChangeColorMode,
    executeChangeColorTheme: state.executeChangeColorTheme,
  };
}
