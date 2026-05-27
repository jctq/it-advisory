'use client';

import { create } from 'zustand';

export type MarketingChromeState = {
  readonly isMobileMenuOpen: boolean;
};

export type MarketingChromeActions = {
  readonly setMobileMenuOpen: (isOpen: boolean) => void;
  readonly executeCloseMobileMenu: () => void;
};

export type MarketingChromeStore = MarketingChromeState & MarketingChromeActions;

export const useMarketingChromeStore = create<MarketingChromeStore>((set) => ({
  isMobileMenuOpen: false,
  setMobileMenuOpen: (isOpen): void => {
    set({ isMobileMenuOpen: isOpen });
  },
  executeCloseMobileMenu: (): void => {
    set({ isMobileMenuOpen: false });
  },
}));
