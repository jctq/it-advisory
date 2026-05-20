'use client';

import { useSyncExternalStore } from 'react';
import {
  resolveClientAdminAppearanceMode,
  resolveServerAdminAppearanceMode,
  resolveClientSystemPrefersDark,
  resolveServerSystemPrefersDark,
  subscribeToAdminAppearanceStorage,
  subscribeToSystemColorScheme,
} from '@/lib/admin/document-appearance';
import { readWorkspaceIsDarkFromDocument } from '@/components/admin/diagnostic-template-editor/workspace-theme';

function subscribeToWorkspaceAppearance(onStoreChange: () => void): () => void {
  if (typeof window === 'undefined') {
    return () => undefined;
  }
  const unsubscribeAdmin = subscribeToAdminAppearanceStorage(onStoreChange);
  const unsubscribeSystem = subscribeToSystemColorScheme(onStoreChange);
  const observer = new MutationObserver(onStoreChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  });
  return () => {
    unsubscribeAdmin();
    unsubscribeSystem();
    observer.disconnect();
  };
}

function resolveClientWorkspaceIsDark(): boolean {
  const mode = resolveClientAdminAppearanceMode();
  const systemPrefersDark = resolveClientSystemPrefersDark();
  const isDark = mode === 'dark' || (mode === 'system' && systemPrefersDark);
  return isDark || readWorkspaceIsDarkFromDocument();
}

function resolveServerWorkspaceIsDark(): boolean {
  const mode = resolveServerAdminAppearanceMode();
  return mode === 'dark';
}

export function useWorkspaceAppearance(): { readonly isDark: boolean } {
  const isDark = useSyncExternalStore(
    subscribeToWorkspaceAppearance,
    resolveClientWorkspaceIsDark,
    resolveServerWorkspaceIsDark,
  );
  return { isDark };
}
