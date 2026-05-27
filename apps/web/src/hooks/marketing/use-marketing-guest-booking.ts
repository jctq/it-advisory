'use client';

import { useEffect, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { GuestBookingManageView } from '@techmd/api-client/marketing-booking-manage-api-client';
import type { PaymentConfigPublic } from '@techmd/api-client/marketing-payment-api-client';
import type { PaymentGatewayId } from '@/domain/payment-types';
import {
  useMarketingGuestBookingStore,
  type GuestBookingManageAuthContext,
  type GuestBookingManagePhase,
  type MarketingGuestBookingStore,
} from '@/store/marketing/marketing-guest-booking-store';

type GuestBookingState = Omit<MarketingGuestBookingStore, 'patchGuestBooking' | 'resetGuestBooking'>;

export type MarketingGuestBookingView = GuestBookingState & {
  readonly patchGuestBooking: MarketingGuestBookingStore['patchGuestBooking'];
  readonly resetGuestBooking: MarketingGuestBookingStore['resetGuestBooking'];
  readonly setPhase: (value: GuestBookingManagePhase) => void;
  readonly setBookingReference: (value: string) => void;
  readonly setEmail: (value: string) => void;
  readonly setPhoneLastFour: (value: string) => void;
  readonly setManageContext: (value: GuestBookingManageAuthContext | null) => void;
  readonly setBooking: (value: GuestBookingManageView | null) => void;
  readonly setPaymentConfig: (value: PaymentConfigPublic | null) => void;
  readonly setSelectedGatewayId: (value: PaymentGatewayId | null) => void;
  readonly setSelectedPaymentMethodId: (value: string | null) => void;
  readonly setIsSubmitting: (value: boolean) => void;
  readonly setIsAccountBootstrapLoading: (value: boolean) => void;
};

function selectGuestBookingState(state: MarketingGuestBookingStore): GuestBookingState {
  return {
    phase: state.phase,
    bookingReference: state.bookingReference,
    email: state.email,
    phoneLastFour: state.phoneLastFour,
    manageContext: state.manageContext,
    booking: state.booking,
    paymentConfig: state.paymentConfig,
    selectedGatewayId: state.selectedGatewayId,
    selectedPaymentMethodId: state.selectedPaymentMethodId,
    isSubmitting: state.isSubmitting,
    isAccountBootstrapLoading: state.isAccountBootstrapLoading,
  };
}

function buildGuestBookingSetters(
  patch: MarketingGuestBookingStore['patchGuestBooking'],
): Omit<MarketingGuestBookingView, keyof GuestBookingState | 'patchGuestBooking' | 'resetGuestBooking'> {
  return {
    setPhase: (value) => patch({ phase: value }),
    setBookingReference: (value) => patch({ bookingReference: value }),
    setEmail: (value) => patch({ email: value }),
    setPhoneLastFour: (value) => patch({ phoneLastFour: value }),
    setManageContext: (value) => patch({ manageContext: value }),
    setBooking: (value) => patch({ booking: value }),
    setPaymentConfig: (value) => patch({ paymentConfig: value }),
    setSelectedGatewayId: (value) => patch({ selectedGatewayId: value }),
    setSelectedPaymentMethodId: (value) => patch({ selectedPaymentMethodId: value }),
    setIsSubmitting: (value) => patch({ isSubmitting: value }),
    setIsAccountBootstrapLoading: (value) => patch({ isAccountBootstrapLoading: value }),
  };
}

/**
 * Guest/account booking manage flow state. Resets when the flow unmounts.
 */
export function useMarketingGuestBooking(): MarketingGuestBookingView {
  const flowState = useMarketingGuestBookingStore(useShallow(selectGuestBookingState));
  const patchGuestBooking = useMarketingGuestBookingStore((state) => state.patchGuestBooking);
  const resetGuestBooking = useMarketingGuestBookingStore((state) => state.resetGuestBooking);
  const setters = useMemo(() => buildGuestBookingSetters(patchGuestBooking), [patchGuestBooking]);
  useEffect(() => {
    return () => {
      resetGuestBooking();
    };
  }, [resetGuestBooking]);
  return {
    ...flowState,
    patchGuestBooking,
    resetGuestBooking,
    ...setters,
  };
}
