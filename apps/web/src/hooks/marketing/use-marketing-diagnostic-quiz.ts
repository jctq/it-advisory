'use client';

import { useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import {
  marketingDiagnosticQuizSessionReadOnlyRef,
  useMarketingDiagnosticQuizStore,
  type MarketingDiagnosticQuizStore,
} from '@/store/marketing/marketing-diagnostic-quiz-store';

type DiagnosticQuizState = Pick<
  MarketingDiagnosticQuizStore,
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

export type MarketingDiagnosticQuizView = DiagnosticQuizState & {
  readonly setGuided: MarketingDiagnosticQuizStore['setGuided'];
  readonly setIsSessionReady: MarketingDiagnosticQuizStore['setIsSessionReady'];
  readonly setTargetSessionError: MarketingDiagnosticQuizStore['setTargetSessionError'];
  readonly setSessionReadOnly: MarketingDiagnosticQuizStore['setSessionReadOnly'];
  readonly setDiagnosticAiEnabled: MarketingDiagnosticQuizStore['setDiagnosticAiEnabled'];
  readonly setActiveTemplate: MarketingDiagnosticQuizStore['setActiveTemplate'];
  readonly setDiagnosticActionsElement: MarketingDiagnosticQuizStore['setDiagnosticActionsElement'];
  readonly setIsDeleteDialogOpen: MarketingDiagnosticQuizStore['setIsDeleteDialogOpen'];
  readonly setIsDeleting: MarketingDiagnosticQuizStore['setIsDeleting'];
  readonly setDeleteError: MarketingDiagnosticQuizStore['setDeleteError'];
  readonly resetQuizSession: MarketingDiagnosticQuizStore['resetQuizSession'];
  readonly sessionReadOnlyRef: typeof marketingDiagnosticQuizSessionReadOnlyRef;
};

function selectDiagnosticQuizState(state: MarketingDiagnosticQuizStore): DiagnosticQuizState {
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
 * Diagnostic quiz session state. Resets when the quiz route unmounts.
 */
export function useMarketingDiagnosticQuiz(): MarketingDiagnosticQuizView {
  const quizState = useMarketingDiagnosticQuizStore(useShallow(selectDiagnosticQuizState));
  const setGuided = useMarketingDiagnosticQuizStore((state) => state.setGuided);
  const setIsSessionReady = useMarketingDiagnosticQuizStore((state) => state.setIsSessionReady);
  const setTargetSessionError = useMarketingDiagnosticQuizStore((state) => state.setTargetSessionError);
  const setSessionReadOnly = useMarketingDiagnosticQuizStore((state) => state.setSessionReadOnly);
  const setDiagnosticAiEnabled = useMarketingDiagnosticQuizStore((state) => state.setDiagnosticAiEnabled);
  const setActiveTemplate = useMarketingDiagnosticQuizStore((state) => state.setActiveTemplate);
  const setDiagnosticActionsElement = useMarketingDiagnosticQuizStore((state) => state.setDiagnosticActionsElement);
  const setIsDeleteDialogOpen = useMarketingDiagnosticQuizStore((state) => state.setIsDeleteDialogOpen);
  const setIsDeleting = useMarketingDiagnosticQuizStore((state) => state.setIsDeleting);
  const setDeleteError = useMarketingDiagnosticQuizStore((state) => state.setDeleteError);
  const resetQuizSession = useMarketingDiagnosticQuizStore((state) => state.resetQuizSession);
  useEffect(() => {
    return () => {
      resetQuizSession();
    };
  }, [resetQuizSession]);
  return {
    ...quizState,
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
    resetQuizSession,
    sessionReadOnlyRef: marketingDiagnosticQuizSessionReadOnlyRef,
  };
}
