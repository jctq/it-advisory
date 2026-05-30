'use client';

import { create } from 'zustand';
import { ACCOUNT_DIAGNOSTICS_DEFAULT_STATUS } from '@/lib/marketing/account-diagnostics-list';
import type { VisitorQuizSessionSummary } from '@/lib/data/quiz-session-types';
import type { BookingListStatusFilter } from '@/lib/marketing/account-booking-status';
import { buildStoreFieldPatch } from '@/store/marketing/set-store-field';

export type MarketingAccountDiagnosticsState = {
  readonly actionError: string | null;
  readonly loadError: string | null;
  readonly isLoading: boolean;
  readonly sessions: readonly VisitorQuizSessionSummary[];
  readonly totalCount: number;
  readonly totalPages: number;
  readonly page: number;
  readonly hasAnySessions: boolean;
  readonly bookingReferenceInput: string;
  readonly debouncedBookingReference: string;
  readonly statusFilter: BookingListStatusFilter;
  readonly isLoadingMore: boolean;
};

export type MarketingAccountDiagnosticsActions = {
  readonly patchAccountDiagnostics: (partial: Partial<MarketingAccountDiagnosticsState>) => void;
  readonly setAccountDiagnosticsField: <K extends keyof MarketingAccountDiagnosticsState>(
    key: K,
    value:
      | MarketingAccountDiagnosticsState[K]
      | ((previous: MarketingAccountDiagnosticsState[K]) => MarketingAccountDiagnosticsState[K]),
  ) => void;
  readonly setSessions: (
    updater:
      | readonly VisitorQuizSessionSummary[]
      | ((previous: readonly VisitorQuizSessionSummary[]) => readonly VisitorQuizSessionSummary[]),
  ) => void;
  readonly resetAccountDiagnostics: () => void;
};

export type MarketingAccountDiagnosticsStore = MarketingAccountDiagnosticsState & MarketingAccountDiagnosticsActions;

function createInitialAccountDiagnosticsState(): MarketingAccountDiagnosticsState {
  return {
    actionError: null,
    loadError: null,
    isLoading: true,
    sessions: [],
    totalCount: 0,
    totalPages: 0,
    page: 1,
    hasAnySessions: false,
    bookingReferenceInput: '',
    debouncedBookingReference: '',
    statusFilter: ACCOUNT_DIAGNOSTICS_DEFAULT_STATUS,
    isLoadingMore: false,
  };
}

export const useMarketingAccountDiagnosticsStore = create<MarketingAccountDiagnosticsStore>((set, get) => ({
  ...createInitialAccountDiagnosticsState(),
  patchAccountDiagnostics: (partial): void => {
    set(partial);
  },
  setAccountDiagnosticsField: (key, value): void => {
    set(buildStoreFieldPatch(get(), key, value));
  },
  setSessions: (updater): void => {
    set((state) => ({
      sessions: typeof updater === 'function' ? updater(state.sessions) : updater,
    }));
  },
  resetAccountDiagnostics: (): void => {
    set(createInitialAccountDiagnosticsState());
  },
}));
