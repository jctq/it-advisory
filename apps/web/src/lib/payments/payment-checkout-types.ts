import type { PaymentGatewayId } from '@/domain/payment-types';
import type { BookingDocument } from '@/domain/types';
import type { BookingPayabilityCode } from '@/lib/payments/evaluate-booking-payability';
import type { CheckoutTimingCollector } from '@/lib/payments/checkout-timing';

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
  readonly diagnosticSessionId: string;
  readonly paymentMethodId: string;
  readonly paymentMethodLabel?: string;
  readonly appBaseUrl: string;
  /** When true, PSP success URL targets a minimal HTML route for in-app browser completion. */
  readonly nativeInAppPaymentReturn?: boolean;
  readonly promoCode?: string | null;
  readonly recordingOptIn?: boolean;
  /** When set, skips redundant diagnostic session fetch (route already validated). */
  readonly diagnosticSessionObjectIdHex?: string;
  readonly timing?: CheckoutTimingCollector;
  /** When true, sends the payment reminder email after checkout is ready (omit on prepare pre-warm). */
  readonly sendPaymentReminderEmail?: boolean;
  /** When false (prepare pre-warm), lifecycle stays pending until the visitor clicks Pay. Defaults to true. */
  readonly checkoutCommitted?: boolean;
};

export type CreateCheckoutSessionResult =
  | {
      readonly ok: true;
      readonly transactionId: string;
      readonly redirectUrl: string | null;
      readonly bookingId: string | null;
      readonly manualConfirm: boolean;
      readonly mock?: boolean;
      readonly bookingStatus: BookingDocument['status'] | null;
    }
  | {
      readonly ok: false;
      readonly code: string;
      readonly error: string;
      readonly payabilityCode?: BookingPayabilityCode;
      readonly debug?: Record<string, unknown>;
    };
