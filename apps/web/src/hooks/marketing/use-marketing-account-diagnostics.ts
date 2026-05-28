'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { AccountDiagnosticsInitialList } from '@/lib/marketing/account-diagnostics-list';
import {
  matchesAccountDiagnosticsListRequest,
  buildDefaultAccountDiagnosticsListRequest,
} from '@/lib/marketing/account-diagnostics-list';
import {
  normalizeVisitorQuizSessionListStatusFilter,
  type VisitorQuizSessionListStatusFilter,
  type VisitorQuizSessionSummary,
} from '@/lib/data/quiz-session-types';
import {
  useMarketingAccountDiagnosticsStore,
  type AccountDiagnosticsDeleteTarget,
  type MarketingAccountDiagnosticsStore,
} from '@/store/marketing/marketing-account-diagnostics-store';

type AccountDiagnosticsState = Omit<
  MarketingAccountDiagnosticsStore,
  'patchAccountDiagnostics' | 'setSessions' | 'resetAccountDiagnostics' | 'setAccountDiagnosticsField'
>;

export type MarketingAccountDiagnosticsView = AccountDiagnosticsState & {
  readonly patchAccountDiagnostics: MarketingAccountDiagnosticsStore['patchAccountDiagnostics'];
  readonly setSessions: MarketingAccountDiagnosticsStore['setSessions'];
  readonly resetAccountDiagnostics: MarketingAccountDiagnosticsStore['resetAccountDiagnostics'];
  readonly setActionError: (value: string | null) => void;
  readonly setLoadError: (value: string | null) => void;
  readonly setIsLoading: (value: boolean) => void;
  readonly setTotalCount: (value: number) => void;
  readonly setTotalPages: (value: number) => void;
  readonly setPage: (value: number | ((previous: number) => number)) => void;
  readonly setHasAnySessions: (value: boolean) => void;
  readonly setDeletingId: (value: string | null) => void;
  readonly setDeleteTarget: (value: AccountDiagnosticsDeleteTarget | null) => void;
  readonly setBookingReferenceInput: (value: string) => void;
  readonly setDebouncedBookingReference: (value: string) => void;
  readonly setStatusFilter: (value: VisitorQuizSessionListStatusFilter) => void;
  readonly setIsLoadingMore: (value: boolean) => void;
};

function selectAccountDiagnosticsState(state: MarketingAccountDiagnosticsStore): AccountDiagnosticsState {
  return {
    actionError: state.actionError,
    loadError: state.loadError,
    isLoading: state.isLoading,
    sessions: state.sessions,
    totalCount: state.totalCount,
    totalPages: state.totalPages,
    page: state.page,
    hasAnySessions: state.hasAnySessions,
    deletingId: state.deletingId,
    deleteTarget: state.deleteTarget,
    bookingReferenceInput: state.bookingReferenceInput,
    debouncedBookingReference: state.debouncedBookingReference,
    statusFilter: state.statusFilter,
    isLoadingMore: state.isLoadingMore,
  };
}

function buildAccountDiagnosticsSetters(
  patch: MarketingAccountDiagnosticsStore['patchAccountDiagnostics'],
  setField: MarketingAccountDiagnosticsStore['setAccountDiagnosticsField'],
): Omit<
  MarketingAccountDiagnosticsView,
  keyof AccountDiagnosticsState | 'patchAccountDiagnostics' | 'setSessions' | 'resetAccountDiagnostics'
> {
  return {
    setActionError: (value) => patch({ actionError: value }),
    setLoadError: (value) => patch({ loadError: value }),
    setIsLoading: (value) => patch({ isLoading: value }),
    setTotalCount: (value) => patch({ totalCount: value }),
    setTotalPages: (value) => patch({ totalPages: value }),
    setPage: (value) => setField('page', value),
    setHasAnySessions: (value) => patch({ hasAnySessions: value }),
    setDeletingId: (value) => patch({ deletingId: value }),
    setDeleteTarget: (value) => patch({ deleteTarget: value }),
    setBookingReferenceInput: (value) => patch({ bookingReferenceInput: value }),
    setDebouncedBookingReference: (value) => patch({ debouncedBookingReference: value }),
    setStatusFilter: (value) =>
      patch({ statusFilter: normalizeVisitorQuizSessionListStatusFilter(value) }),
    setIsLoadingMore: (value) => patch({ isLoadingMore: value }),
  };
}

type UseMarketingAccountDiagnosticsOptions = {
  readonly initialList?: AccountDiagnosticsInitialList;
};

/**
 * Account diagnostics list state with stable setters. Resets when the panel unmounts.
 */
export function useMarketingAccountDiagnostics(
  options: UseMarketingAccountDiagnosticsOptions = {},
): MarketingAccountDiagnosticsView {
  const defaultListRequest = buildDefaultAccountDiagnosticsListRequest();
  const hasServerInitialList =
    options.initialList !== undefined &&
    matchesAccountDiagnosticsListRequest(options.initialList, defaultListRequest);
  const flowState = useMarketingAccountDiagnosticsStore(useShallow(selectAccountDiagnosticsState));
  const patchAccountDiagnostics = useMarketingAccountDiagnosticsStore((state) => state.patchAccountDiagnostics);
  const setAccountDiagnosticsField = useMarketingAccountDiagnosticsStore((state) => state.setAccountDiagnosticsField);
  const setSessions = useMarketingAccountDiagnosticsStore((state) => state.setSessions);
  const resetAccountDiagnostics = useMarketingAccountDiagnosticsStore((state) => state.resetAccountDiagnostics);
  const setters = useMemo(
    () => buildAccountDiagnosticsSetters(patchAccountDiagnostics, setAccountDiagnosticsField),
    [patchAccountDiagnostics, setAccountDiagnosticsField],
  );
  const hasHydratedServerListRef = useRef(false);
  const initialList = options.initialList;
  useEffect(() => {
    if (!hasServerInitialList || hasHydratedServerListRef.current || initialList === undefined) {
      return;
    }
    hasHydratedServerListRef.current = true;
    patchAccountDiagnostics({
      isLoading: false,
      sessions: initialList.result.sessions,
      totalCount: initialList.result.totalCount,
      totalPages: initialList.result.totalPages,
      hasAnySessions: initialList.result.hasAnySessions,
    });
  }, [hasServerInitialList, initialList, patchAccountDiagnostics]);
  useEffect(() => {
    return () => {
      resetAccountDiagnostics();
    };
  }, [resetAccountDiagnostics]);
  return {
    ...flowState,
    patchAccountDiagnostics,
    setSessions,
    resetAccountDiagnostics,
    ...setters,
  };
}
