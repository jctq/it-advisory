import { z } from 'zod';
import { PAYMENT_GATEWAY_IDS } from '@/domain/payment-types';

export const guestBookingManageCredentialsSchema = z.object({
  bookingReference: z.string().trim().min(4).max(12),
  email: z.string().trim().email().max(320),
  phoneLastFour: z.string().trim().regex(/^\d{4}$/, 'Enter the last 4 digits of your phone number.'),
});

export const guestBookingManageCheckoutSchema = guestBookingManageCredentialsSchema.extend({
  gatewayId: z.enum(PAYMENT_GATEWAY_IDS),
  paymentMethodId: z.string().min(1).max(64),
  paymentMethodLabel: z.string().min(1).max(120).optional(),
  /** When set (e.g. native), must match request origin, NEXT_PUBLIC_APP_URL, or CHECKOUT_ALLOWED_APP_BASE_URLS. */
  appBaseUrl: z.string().max(240).optional(),
  nativeInAppPaymentReturn: z.boolean().optional(),
});
