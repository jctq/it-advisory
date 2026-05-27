import { PROJECT_RESCUE_SERVICE_TITLE } from '@techmd/diagnostic-core/project-rescue-service-context';
import type { PaymentGatewayId } from '@/domain/payment-types';
import type { PaymentConfigPublic } from '@techmd/api-client/marketing-payment-api-client';
import type {
  PublicCatalogFallbackCheckout,
  PublicCatalogServiceRow,
} from '@/lib/data/public-catalog-services';
import { formatInTimeZone } from 'date-fns-tz';
import { PRIMARY_TIMEZONE } from '@/lib/timezone';

export type BookingSlotPhase = 'date' | 'details' | 'payment';

export type BookingPhase = BookingSlotPhase | 'processing' | 'success' | 'error';

export type BookSessionGateStatus = 'loading' | 'missing' | 'invalid_format' | 'not_found' | 'already_booked' | 'ready';

export type PaymentMethodId = 'card' | 'gcash' | 'maya' | 'bank_transfer' | 'paypal';

export type ConfirmedSlotDisplay = {
  readonly dateLong: string;
  readonly timeLabel: string;
};

export type ConfirmedCalendarSlot = {
  readonly startsAtIso: string;
  readonly timezone: string;
};

export type AvailabilityStatus = 'idle' | 'loading' | 'error' | 'ready';

export type MarketingBookingFlowState = {
  readonly sessionGateStatus: BookSessionGateStatus;
  readonly paymentCancelledNotice: boolean;
  readonly serverClockOffsetMs: number | null;
  readonly phase: BookingPhase;
  readonly visibleManilaYearMonth: string;
  readonly selectedDate: Date | null;
  readonly selectedTime: string | null;
  readonly slotDialogOpen: boolean;
  readonly slotDialogManilaYmd: string | null;
  readonly fullName: string;
  readonly email: string;
  readonly company: string;
  readonly phone: string;
  readonly fieldErrors: Record<string, string>;
  readonly paymentMethod: PaymentMethodId | null;
  readonly paymentConfig: PaymentConfigPublic | null;
  readonly promoCode: string;
  readonly recordingOptIn: boolean;
  readonly debouncedPromoCode: string;
  readonly promoError: string | null;
  readonly selectedGatewayId: PaymentGatewayId | null;
  readonly selectedPaymentMethodId: string | null;
  readonly availabilityByDate: Record<string, readonly string[]>;
  readonly availabilityStatus: AvailabilityStatus;
  readonly availabilityError: string | null;
  readonly errorMessage: string | null;
  readonly successPaymentLabel: string;
  readonly confirmedBookingReference: string | null;
  readonly confirmedMeetingUrl: string | null;
  readonly confirmedSlotDisplay: ConfirmedSlotDisplay | null;
  readonly confirmedCalendarSlot: ConfirmedCalendarSlot | null;
  readonly successBookingStatus: 'pending' | 'confirmed' | 'cancelled' | null;
  readonly paidAmountLabel: string | null;
  readonly showPaidSummary: boolean;
  readonly confirmedServiceKey: string;
  readonly confirmedCalendarTitle: string;
  readonly confirmedCatalogService: PublicCatalogServiceRow | null;
  readonly hasEnabledCatalog: boolean | null;
  readonly catalogFallbackCheckout: PublicCatalogFallbackCheckout | null;
  readonly checkoutCatalogService: PublicCatalogServiceRow | null;
};

export const DEFAULT_BOOKING_SERVICE_KEY = 'project-rescue' as const;

export function createInitialMarketingBookingFlowState(): MarketingBookingFlowState {
  return {
    sessionGateStatus: 'loading',
    paymentCancelledNotice: false,
    serverClockOffsetMs: null,
    phase: 'date',
    visibleManilaYearMonth: formatInTimeZone(new Date(), PRIMARY_TIMEZONE, 'yyyy-MM'),
    selectedDate: null,
    selectedTime: null,
    slotDialogOpen: false,
    slotDialogManilaYmd: null,
    fullName: '',
    email: '',
    company: '',
    phone: '',
    fieldErrors: {},
    paymentMethod: 'card',
    paymentConfig: null,
    promoCode: '',
    recordingOptIn: false,
    debouncedPromoCode: '',
    promoError: null,
    selectedGatewayId: null,
    selectedPaymentMethodId: null,
    availabilityByDate: {},
    availabilityStatus: 'idle',
    availabilityError: null,
    errorMessage: null,
    successPaymentLabel: '',
    confirmedBookingReference: null,
    confirmedMeetingUrl: null,
    confirmedSlotDisplay: null,
    confirmedCalendarSlot: null,
    successBookingStatus: null,
    paidAmountLabel: null,
    showPaidSummary: false,
    confirmedServiceKey: DEFAULT_BOOKING_SERVICE_KEY,
    confirmedCalendarTitle: PROJECT_RESCUE_SERVICE_TITLE,
    confirmedCatalogService: null,
    hasEnabledCatalog: null,
    catalogFallbackCheckout: null,
    checkoutCatalogService: null,
  };
}
