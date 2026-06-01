'use client';

import { useSyncExternalStore } from 'react';

function subscribeDocumentVisible(onStoreChange: () => void): () => void {
  const executeHandleChange = (): void => {
    onStoreChange();
  };
  document.addEventListener('visibilitychange', executeHandleChange);
  return () => {
    document.removeEventListener('visibilitychange', executeHandleChange);
  };
}

function resolveClientDocumentVisible(): boolean {
  return document.visibilityState !== 'hidden';
}

function resolveServerDocumentVisible(): boolean {
  return true;
}

/** True when the document tab is visible (SSR-safe). */
export function useDocumentVisible(): boolean {
  return useSyncExternalStore(
    subscribeDocumentVisible,
    resolveClientDocumentVisible,
    resolveServerDocumentVisible,
  );
}
