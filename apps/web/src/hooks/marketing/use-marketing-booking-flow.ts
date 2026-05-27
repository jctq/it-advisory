'use client';

import { useEffect, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { PaymentConfigPublic } from '@techmd/api-client/marketing-payment-api-client';
import type { PaymentGatewayId } from '@/domain/payment-types';
import type {
  PublicCatalogFallbackCheckout,
  PublicCatalogServiceRow,
} from '@/lib/data/public-catalog-services';
import {
  selectMarketingBookingFlowState,
  useMarketingBookingFlowStore,
  type MarketingBookingFlowStore,
} from '@/store/marketing/marketing-booking-flow-store';
import type {
  BookSessionGateStatus,
  BookingPhase,
  ConfirmedCalendarSlot,
  ConfirmedSlotDisplay,
  MarketingBookingFlowState,
  PaymentMethodId,
} from '@/store/marketing/marketing-booking-flow-types';

export type MarketingBookingFlowView = MarketingBookingFlowState & {
  readonly patchBookingFlow: MarketingBookingFlowStore['patchBookingFlow'];
  readonly setBookingFlowField: MarketingBookingFlowStore['setBookingFlowField'];
  readonly resetBookingFlow: MarketingBookingFlowStore['resetBookingFlow'];
  readonly setSessionGateStatus: (value: BookSessionGateStatus) => void;
  readonly setPaymentCancelledNotice: (value: boolean) => void;
  readonly setServerClockOffsetMs: (value: number | null) => void;
  readonly setPhase: (value: BookingPhase) => void;
  readonly setVisibleManilaYearMonth: (
    value: string | ((previous: string) => string),
  ) => void;
  readonly setSelectedDate: (value: Date | null) => void;
  readonly setSelectedTime: (value: string | null | ((previous: string | null) => string | null)) => void;
  readonly setSlotDialogOpen: (value: boolean) => void;
  readonly setSlotDialogManilaYmd: (value: string | null) => void;
  readonly setFullName: (value: string | ((previous: string) => string)) => void;
  readonly setEmail: (value: string | ((previous: string) => string)) => void;
  readonly setCompany: (value: string | ((previous: string) => string)) => void;
  readonly setPhone: (value: string | ((previous: string) => string)) => void;
  readonly setFieldErrors: (value: Record<string, string>) => void;
  readonly setPaymentMethod: (value: PaymentMethodId | null) => void;
  readonly setPaymentConfig: (value: PaymentConfigPublic | null) => void;
  readonly setPromoCode: (value: string) => void;
  readonly setRecordingOptIn: (value: boolean) => void;
  readonly setDebouncedPromoCode: (value: string) => void;
  readonly setPromoError: (value: string | null) => void;
  readonly setSelectedGatewayId: (value: PaymentGatewayId | null) => void;
  readonly setSelectedPaymentMethodId: (value: string | null) => void;
  readonly setAvailabilityByDate: (value: Record<string, readonly string[]>) => void;
  readonly setAvailabilityStatus: (value: MarketingBookingFlowState['availabilityStatus']) => void;
  readonly setAvailabilityError: (value: string | null) => void;
  readonly setErrorMessage: (value: string | null) => void;
  readonly setSuccessPaymentLabel: (value: string) => void;
  readonly setConfirmedBookingReference: (value: string | null) => void;
  readonly setConfirmedMeetingUrl: (value: string | null) => void;
  readonly setConfirmedSlotDisplay: (value: ConfirmedSlotDisplay | null) => void;
  readonly setConfirmedCalendarSlot: (value: ConfirmedCalendarSlot | null) => void;
  readonly setSuccessBookingStatus: (value: MarketingBookingFlowState['successBookingStatus']) => void;
  readonly setPaidAmountLabel: (value: string | null) => void;
  readonly setShowPaidSummary: (value: boolean) => void;
  readonly setConfirmedServiceKey: (value: string) => void;
  readonly setConfirmedCalendarTitle: (value: string) => void;
  readonly setConfirmedCatalogService: (value: PublicCatalogServiceRow | null) => void;
  readonly setHasEnabledCatalog: (value: boolean | null) => void;
  readonly setCatalogFallbackCheckout: (value: PublicCatalogFallbackCheckout | null) => void;
  readonly setCheckoutCatalogService: (value: PublicCatalogServiceRow | null) => void;
};

function buildBookingFlowSetters(
  patchBookingFlow: MarketingBookingFlowStore['patchBookingFlow'],
  setBookingFlowField: MarketingBookingFlowStore['setBookingFlowField'],
): Omit<
  MarketingBookingFlowView,
  keyof MarketingBookingFlowState | 'patchBookingFlow' | 'setBookingFlowField' | 'resetBookingFlow'
> {
  return {
    setSessionGateStatus: (value) => patchBookingFlow({ sessionGateStatus: value }),
    setPaymentCancelledNotice: (value) => patchBookingFlow({ paymentCancelledNotice: value }),
    setServerClockOffsetMs: (value) => patchBookingFlow({ serverClockOffsetMs: value }),
    setPhase: (value) => patchBookingFlow({ phase: value }),
    setVisibleManilaYearMonth: (value) => setBookingFlowField('visibleManilaYearMonth', value),
    setSelectedDate: (value) => patchBookingFlow({ selectedDate: value }),
    setSelectedTime: (value) => setBookingFlowField('selectedTime', value),
    setSlotDialogOpen: (value) => patchBookingFlow({ slotDialogOpen: value }),
    setSlotDialogManilaYmd: (value) => patchBookingFlow({ slotDialogManilaYmd: value }),
    setFullName: (value) => setBookingFlowField('fullName', value),
    setEmail: (value) => setBookingFlowField('email', value),
    setCompany: (value) => setBookingFlowField('company', value),
    setPhone: (value) => setBookingFlowField('phone', value),
    setFieldErrors: (value) => patchBookingFlow({ fieldErrors: value }),
    setPaymentMethod: (value) => patchBookingFlow({ paymentMethod: value }),
    setPaymentConfig: (value) => patchBookingFlow({ paymentConfig: value }),
    setPromoCode: (value) => patchBookingFlow({ promoCode: value }),
    setRecordingOptIn: (value) => patchBookingFlow({ recordingOptIn: value }),
    setDebouncedPromoCode: (value) => patchBookingFlow({ debouncedPromoCode: value }),
    setPromoError: (value) => patchBookingFlow({ promoError: value }),
    setSelectedGatewayId: (value) => patchBookingFlow({ selectedGatewayId: value }),
    setSelectedPaymentMethodId: (value) => patchBookingFlow({ selectedPaymentMethodId: value }),
    setAvailabilityByDate: (value) => patchBookingFlow({ availabilityByDate: value }),
    setAvailabilityStatus: (value) => patchBookingFlow({ availabilityStatus: value }),
    setAvailabilityError: (value) => patchBookingFlow({ availabilityError: value }),
    setErrorMessage: (value) => patchBookingFlow({ errorMessage: value }),
    setSuccessPaymentLabel: (value) => patchBookingFlow({ successPaymentLabel: value }),
    setConfirmedBookingReference: (value) => patchBookingFlow({ confirmedBookingReference: value }),
    setConfirmedMeetingUrl: (value) => patchBookingFlow({ confirmedMeetingUrl: value }),
    setConfirmedSlotDisplay: (value) => patchBookingFlow({ confirmedSlotDisplay: value }),
    setConfirmedCalendarSlot: (value) => patchBookingFlow({ confirmedCalendarSlot: value }),
    setSuccessBookingStatus: (value) => patchBookingFlow({ successBookingStatus: value }),
    setPaidAmountLabel: (value) => patchBookingFlow({ paidAmountLabel: value }),
    setShowPaidSummary: (value) => patchBookingFlow({ showPaidSummary: value }),
    setConfirmedServiceKey: (value) => patchBookingFlow({ confirmedServiceKey: value }),
    setConfirmedCalendarTitle: (value) => patchBookingFlow({ confirmedCalendarTitle: value }),
    setConfirmedCatalogService: (value) => patchBookingFlow({ confirmedCatalogService: value }),
    setHasEnabledCatalog: (value) => patchBookingFlow({ hasEnabledCatalog: value }),
    setCatalogFallbackCheckout: (value) => patchBookingFlow({ catalogFallbackCheckout: value }),
    setCheckoutCatalogService: (value) => patchBookingFlow({ checkoutCatalogService: value }),
  };
}

/**
 * Booking checkout state with stable setters. Resets when the route unmounts.
 */
export function useMarketingBookingFlow(): MarketingBookingFlowView {
  const flowState = useMarketingBookingFlowStore(useShallow(selectMarketingBookingFlowState));
  const patchBookingFlow = useMarketingBookingFlowStore((state) => state.patchBookingFlow);
  const setBookingFlowField = useMarketingBookingFlowStore((state) => state.setBookingFlowField);
  const resetBookingFlow = useMarketingBookingFlowStore((state) => state.resetBookingFlow);
  const setters = useMemo(
    () => buildBookingFlowSetters(patchBookingFlow, setBookingFlowField),
    [patchBookingFlow, setBookingFlowField],
  );
  useEffect(() => {
    return () => {
      resetBookingFlow();
    };
  }, [resetBookingFlow]);
  return {
    ...flowState,
    patchBookingFlow,
    setBookingFlowField,
    resetBookingFlow,
    ...setters,
  };
}
