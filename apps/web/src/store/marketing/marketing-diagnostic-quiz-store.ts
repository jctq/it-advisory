'use client';

import { create } from 'zustand';
import type { PublicDiagnosticTemplateValue } from '@/lib/diagnostic-template-types';
import { GUIDED_DIAGNOSTIC_EMPTY, type GuidedDiagnosticV1 } from '@/lib/marketing/guided-diagnostic-types';

export type MarketingDiagnosticQuizState = {
  readonly guided: GuidedDiagnosticV1;
  readonly isSessionReady: boolean;
  readonly targetSessionError: string | null;
  readonly sessionReadOnly: boolean;
  readonly diagnosticAiEnabled: boolean;
  readonly activeTemplate: PublicDiagnosticTemplateValue | null;
  readonly diagnosticActionsElement: HTMLDivElement | null;
  readonly isDeleteDialogOpen: boolean;
  readonly isDeleting: boolean;
  readonly deleteError: string | null;
};

export type MarketingDiagnosticQuizActions = {
  readonly setGuided: (updater: GuidedDiagnosticV1 | ((previous: GuidedDiagnosticV1) => GuidedDiagnosticV1)) => void;
  readonly setIsSessionReady: (isReady: boolean) => void;
  readonly setTargetSessionError: (error: string | null) => void;
  readonly setSessionReadOnly: (readOnly: boolean) => void;
  readonly setDiagnosticAiEnabled: (enabled: boolean) => void;
  readonly setActiveTemplate: (template: PublicDiagnosticTemplateValue | null) => void;
  readonly setDiagnosticActionsElement: (element: HTMLDivElement | null) => void;
  readonly setIsDeleteDialogOpen: (isOpen: boolean) => void;
  readonly setIsDeleting: (isDeleting: boolean) => void;
  readonly setDeleteError: (error: string | null) => void;
  readonly resetQuizSession: () => void;
};

export type MarketingDiagnosticQuizStore = MarketingDiagnosticQuizState & MarketingDiagnosticQuizActions;

/** Imperative mirror used by persist/leave handlers that must read without subscribing. */
export const marketingDiagnosticQuizSessionReadOnlyRef = { current: false };

export const useMarketingDiagnosticQuizStore = create<MarketingDiagnosticQuizStore>((set) => ({
  guided: GUIDED_DIAGNOSTIC_EMPTY,
  isSessionReady: false,
  targetSessionError: null,
  sessionReadOnly: false,
  diagnosticAiEnabled: false,
  activeTemplate: null,
  diagnosticActionsElement: null,
  isDeleteDialogOpen: false,
  isDeleting: false,
  deleteError: null,
  setGuided: (updater): void => {
    set((state) => ({
      guided: typeof updater === 'function' ? updater(state.guided) : updater,
    }));
  },
  setIsSessionReady: (isSessionReady): void => {
    set({ isSessionReady });
  },
  setTargetSessionError: (targetSessionError): void => {
    set({ targetSessionError });
  },
  setSessionReadOnly: (sessionReadOnly): void => {
    marketingDiagnosticQuizSessionReadOnlyRef.current = sessionReadOnly;
    set({ sessionReadOnly });
  },
  setDiagnosticAiEnabled: (diagnosticAiEnabled): void => {
    set({ diagnosticAiEnabled });
  },
  setActiveTemplate: (activeTemplate): void => {
    set({ activeTemplate });
  },
  setDiagnosticActionsElement: (diagnosticActionsElement): void => {
    set({ diagnosticActionsElement });
  },
  setIsDeleteDialogOpen: (isDeleteDialogOpen): void => {
    set({ isDeleteDialogOpen });
  },
  setIsDeleting: (isDeleting): void => {
    set({ isDeleting });
  },
  setDeleteError: (deleteError): void => {
    set({ deleteError });
  },
  resetQuizSession: (): void => {
    marketingDiagnosticQuizSessionReadOnlyRef.current = false;
    set({
      guided: GUIDED_DIAGNOSTIC_EMPTY,
      isSessionReady: false,
      targetSessionError: null,
      sessionReadOnly: false,
      diagnosticAiEnabled: false,
      activeTemplate: null,
      diagnosticActionsElement: null,
      isDeleteDialogOpen: false,
      isDeleting: false,
      deleteError: null,
    });
  },
}));
