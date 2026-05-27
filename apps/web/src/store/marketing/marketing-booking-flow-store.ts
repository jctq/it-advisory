'use client';

import { create } from 'zustand';
import {
  createInitialMarketingBookingFlowState,
  type MarketingBookingFlowState,
} from '@/store/marketing/marketing-booking-flow-types';
import { buildStoreFieldPatch } from '@/store/marketing/set-store-field';

export type MarketingBookingFlowActions = {
  readonly patchBookingFlow: (partial: Partial<MarketingBookingFlowState>) => void;
  readonly setBookingFlowField: <K extends keyof MarketingBookingFlowState>(
    key: K,
    value: MarketingBookingFlowState[K] | ((previous: MarketingBookingFlowState[K]) => MarketingBookingFlowState[K]),
  ) => void;
  readonly resetBookingFlow: () => void;
};

export type MarketingBookingFlowStore = MarketingBookingFlowState & MarketingBookingFlowActions;

export const useMarketingBookingFlowStore = create<MarketingBookingFlowStore>((set, get) => ({
  ...createInitialMarketingBookingFlowState(),
  patchBookingFlow: (partial): void => {
    set(partial);
  },
  setBookingFlowField: (key, value): void => {
    set(buildStoreFieldPatch(get(), key, value));
  },
  resetBookingFlow: (): void => {
    set(createInitialMarketingBookingFlowState());
  },
}));

export function selectMarketingBookingFlowState(
  state: MarketingBookingFlowStore,
): MarketingBookingFlowState {
  return {
    sessionGateStatus: state.sessionGateStatus,
    paymentCancelledNotice: state.paymentCancelledNotice,
    serverClockOffsetMs: state.serverClockOffsetMs,
    phase: state.phase,
    visibleManilaYearMonth: state.visibleManilaYearMonth,
    selectedDate: state.selectedDate,
    selectedTime: state.selectedTime,
    slotDialogOpen: state.slotDialogOpen,
    slotDialogManilaYmd: state.slotDialogManilaYmd,
    fullName: state.fullName,
    email: state.email,
    company: state.company,
    phone: state.phone,
    fieldErrors: state.fieldErrors,
    paymentMethod: state.paymentMethod,
    paymentConfig: state.paymentConfig,
    promoCode: state.promoCode,
    recordingOptIn: state.recordingOptIn,
    debouncedPromoCode: state.debouncedPromoCode,
    promoError: state.promoError,
    selectedGatewayId: state.selectedGatewayId,
    selectedPaymentMethodId: state.selectedPaymentMethodId,
    availabilityByDate: state.availabilityByDate,
    availabilityStatus: state.availabilityStatus,
    availabilityError: state.availabilityError,
    errorMessage: state.errorMessage,
    successPaymentLabel: state.successPaymentLabel,
    confirmedBookingReference: state.confirmedBookingReference,
    confirmedMeetingUrl: state.confirmedMeetingUrl,
    confirmedSlotDisplay: state.confirmedSlotDisplay,
    confirmedCalendarSlot: state.confirmedCalendarSlot,
    successBookingStatus: state.successBookingStatus,
    paidAmountLabel: state.paidAmountLabel,
    showPaidSummary: state.showPaidSummary,
    confirmedServiceKey: state.confirmedServiceKey,
    confirmedCalendarTitle: state.confirmedCalendarTitle,
    confirmedCatalogService: state.confirmedCatalogService,
    hasEnabledCatalog: state.hasEnabledCatalog,
    catalogFallbackCheckout: state.catalogFallbackCheckout,
    checkoutCatalogService: state.checkoutCatalogService,
  };
}
