'use client';

import { create } from 'zustand';
import type { GuestBookingManageView } from '@techmd/api-client/marketing-booking-manage-api-client';
import type { PaymentConfigPublic } from '@techmd/api-client/marketing-payment-api-client';
import type { PaymentGatewayId } from '@/domain/payment-types';
import type { GuestBookingManageCredentials } from '@techmd/api-client/marketing-booking-manage-api-client';

export type GuestBookingManageAuthContext =
  | { readonly kind: 'guest'; readonly credentials: GuestBookingManageCredentials }
  | { readonly kind: 'account'; readonly bookingId: string };

export type GuestBookingManagePhase = 'lookup' | 'result' | 'paying';

export type MarketingGuestBookingState = {
  readonly phase: GuestBookingManagePhase;
  readonly bookingReference: string;
  readonly email: string;
  readonly phoneLastFour: string;
  readonly manageContext: GuestBookingManageAuthContext | null;
  readonly booking: GuestBookingManageView | null;
  readonly paymentConfig: PaymentConfigPublic | null;
  readonly selectedGatewayId: PaymentGatewayId | null;
  readonly selectedPaymentMethodId: string | null;
  readonly isSubmitting: boolean;
  readonly isAccountBootstrapLoading: boolean;
};

export type MarketingGuestBookingActions = {
  readonly patchGuestBooking: (partial: Partial<MarketingGuestBookingState>) => void;
  readonly resetGuestBooking: () => void;
};

export type MarketingGuestBookingStore = MarketingGuestBookingState & MarketingGuestBookingActions;

function createInitialGuestBookingState(): MarketingGuestBookingState {
  return {
    phase: 'lookup',
    bookingReference: '',
    email: '',
    phoneLastFour: '',
    manageContext: null,
    booking: null,
    paymentConfig: null,
    selectedGatewayId: null,
    selectedPaymentMethodId: null,
    isSubmitting: false,
    isAccountBootstrapLoading: false,
  };
}

export const useMarketingGuestBookingStore = create<MarketingGuestBookingStore>((set) => ({
  ...createInitialGuestBookingState(),
  patchGuestBooking: (partial): void => {
    set(partial);
  },
  resetGuestBooking: (): void => {
    set(createInitialGuestBookingState());
  },
}));
