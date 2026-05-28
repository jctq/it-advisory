'use client';

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';

type SupportReportContextValue = {
  readonly captureRootRef: RefObject<HTMLDivElement | null>;
  readonly isDialogOpen: boolean;
  readonly openReportDialog: () => void;
  readonly closeReportDialog: () => void;
};

const SupportReportContext = createContext<SupportReportContextValue | null>(null);

export function useSupportReport(): SupportReportContextValue {
  const context = useContext(SupportReportContext);
  if (context === null) {
    throw new Error('useSupportReport must be used within SupportReportProvider.');
  }
  return context;
}

type SupportReportProviderProps = {
  readonly children: ReactNode;
};

/**
 * Provides screen capture target ref and report dialog state for marketing pages.
 */
export function SupportReportProvider(props: SupportReportProviderProps) {
  const captureRootRef = useRef<HTMLDivElement | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const openReportDialog = useCallback(() => {
    setIsDialogOpen(true);
  }, []);
  const closeReportDialog = useCallback(() => {
    setIsDialogOpen(false);
  }, []);
  const value = useMemo<SupportReportContextValue>(
    () => ({
      captureRootRef,
      isDialogOpen,
      openReportDialog,
      closeReportDialog,
    }),
    [closeReportDialog, isDialogOpen, openReportDialog],
  );
  return <SupportReportContext.Provider value={value}>{props.children}</SupportReportContext.Provider>;
}

export function resolveSupportReportCaptureElement(
  captureRootRef: RefObject<HTMLDivElement | null>,
): HTMLElement | null {
  if (captureRootRef.current !== null) {
    return captureRootRef.current;
  }
  const marketingMain = document.getElementById('marketing-main-content');
  if (marketingMain !== null) {
    return marketingMain;
  }
  return document.body;
}
