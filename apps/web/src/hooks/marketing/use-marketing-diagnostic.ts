'use client';

import { useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import {
  marketingDiagnosticSessionReadOnlyRef,
  useMarketingDiagnosticStore,
  type MarketingDiagnosticStore,
} from '@/store/marketing/marketing-diagnostic-store';

type DiagnosticSessionUiState = Pick<
  MarketingDiagnosticStore,
  | 'guided'
  | 'isSessionReady'
  | 'targetSessionError'
  | 'sessionReadOnly'
  | 'diagnosticAiEnabled'
  | 'activeTemplate'
  | 'diagnosticActionsElement'
  | 'isDeleteDialogOpen'
  | 'isDeleting'
  | 'deleteError'
>;

export type MarketingDiagnosticView = DiagnosticSessionUiState & {
  readonly setGuided: MarketingDiagnosticStore['setGuided'];
  readonly setIsSessionReady: MarketingDiagnosticStore['setIsSessionReady'];
  readonly setTargetSessionError: MarketingDiagnosticStore['setTargetSessionError'];
  readonly setSessionReadOnly: MarketingDiagnosticStore['setSessionReadOnly'];
  readonly setDiagnosticAiEnabled: MarketingDiagnosticStore['setDiagnosticAiEnabled'];
  readonly setActiveTemplate: MarketingDiagnosticStore['setActiveTemplate'];
  readonly setDiagnosticActionsElement: MarketingDiagnosticStore['setDiagnosticActionsElement'];
  readonly setIsDeleteDialogOpen: MarketingDiagnosticStore['setIsDeleteDialogOpen'];
  readonly setIsDeleting: MarketingDiagnosticStore['setIsDeleting'];
  readonly setDeleteError: MarketingDiagnosticStore['setDeleteError'];
  readonly resetDiagnosticSession: MarketingDiagnosticStore['resetDiagnosticSession'];
  readonly sessionReadOnlyRef: typeof marketingDiagnosticSessionReadOnlyRef;
};

function selectDiagnosticSessionState(state: MarketingDiagnosticStore): DiagnosticSessionUiState {
  return {
    guided: state.guided,
    isSessionReady: state.isSessionReady,
    targetSessionError: state.targetSessionError,
    sessionReadOnly: state.sessionReadOnly,
    diagnosticAiEnabled: state.diagnosticAiEnabled,
    activeTemplate: state.activeTemplate,
    diagnosticActionsElement: state.diagnosticActionsElement,
    isDeleteDialogOpen: state.isDeleteDialogOpen,
    isDeleting: state.isDeleting,
    deleteError: state.deleteError,
  };
}

/**
 * Diagnostic session UI state. Resets when the diagnostic route unmounts.
 */
export function useMarketingDiagnostic(): MarketingDiagnosticView {
  const diagnosticState = useMarketingDiagnosticStore(useShallow(selectDiagnosticSessionState));
  const setGuided = useMarketingDiagnosticStore((state) => state.setGuided);
  const setIsSessionReady = useMarketingDiagnosticStore((state) => state.setIsSessionReady);
  const setTargetSessionError = useMarketingDiagnosticStore((state) => state.setTargetSessionError);
  const setSessionReadOnly = useMarketingDiagnosticStore((state) => state.setSessionReadOnly);
  const setDiagnosticAiEnabled = useMarketingDiagnosticStore((state) => state.setDiagnosticAiEnabled);
  const setActiveTemplate = useMarketingDiagnosticStore((state) => state.setActiveTemplate);
  const setDiagnosticActionsElement = useMarketingDiagnosticStore((state) => state.setDiagnosticActionsElement);
  const setIsDeleteDialogOpen = useMarketingDiagnosticStore((state) => state.setIsDeleteDialogOpen);
  const setIsDeleting = useMarketingDiagnosticStore((state) => state.setIsDeleting);
  const setDeleteError = useMarketingDiagnosticStore((state) => state.setDeleteError);
  const resetDiagnosticSession = useMarketingDiagnosticStore((state) => state.resetDiagnosticSession);
  useEffect(() => {
    return () => {
      resetDiagnosticSession();
    };
  }, [resetDiagnosticSession]);
  return {
    ...diagnosticState,
    setGuided,
    setIsSessionReady,
    setTargetSessionError,
    setSessionReadOnly,
    setDiagnosticAiEnabled,
    setActiveTemplate,
    setDiagnosticActionsElement,
    setIsDeleteDialogOpen,
    setIsDeleting,
    setDeleteError,
    resetDiagnosticSession,
    sessionReadOnlyRef: marketingDiagnosticSessionReadOnlyRef,
  };
}
