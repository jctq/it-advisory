import type { PaymentGatewayId } from '@/domain/payment-types';
import type { BookingPayabilityCode } from '@/lib/payments/evaluate-booking-payability';

export type CreateCheckoutSessionParams = {
  readonly gatewayId: PaymentGatewayId;
  readonly visitorId: string;
  readonly date: string;
  readonly time: string;
  readonly serviceKey: string;
  readonly customerName: string;
  readonly customerEmail: string;
  readonly customerCompany?: string;
  readonly customerPhone: string;
  /** Opaque marketing ref or legacy ObjectId hex; required for marketing checkout. */
  readonly quizSessionId: string;
  readonly paymentMethodId: string;
  readonly paymentMethodLabel?: string;
  readonly appBaseUrl: string;
  /** When true, PSP success URL targets a minimal HTML route for in-app browser completion. */
  readonly nativeInAppPaymentReturn?: boolean;
  readonly promoCode?: string | null;
  readonly recordingOptIn?: boolean;
};

export type CreateCheckoutSessionResult =
  | {
      readonly ok: true;
      readonly transactionId: string;
      readonly redirectUrl: string | null;
      readonly bookingId: string | null;
      readonly manualConfirm: boolean;
      readonly mock?: boolean;
      readonly bookingStatus: 'pending' | 'confirmed' | 'completed' | 'cancelled' | null;
    }
  | {
      readonly ok: false;
      readonly code: string;
      readonly error: string;
      readonly payabilityCode?: BookingPayabilityCode;
      readonly debug?: Record<string, unknown>;
    };
