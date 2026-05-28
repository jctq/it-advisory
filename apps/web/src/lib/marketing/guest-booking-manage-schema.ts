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
  promoCode: z.string().max(64).optional(),
});

const mongoObjectIdHexSchema = z
  .string()
  .trim()
  .length(24)
  .regex(/^[a-f0-9]+$/i, 'Invalid booking id.');

export const accountBookingManageLookupSchema = z.object({
  bookingId: mongoObjectIdHexSchema,
});

export const accountBookingManageCheckoutSchema = z.object({
  bookingId: mongoObjectIdHexSchema,
  gatewayId: z.enum(PAYMENT_GATEWAY_IDS),
  paymentMethodId: z.string().min(1).max(64),
  paymentMethodLabel: z.string().min(1).max(120).optional(),
  appBaseUrl: z.string().max(240).optional(),
  nativeInAppPaymentReturn: z.boolean().optional(),
  promoCode: z.string().max(64).optional(),
});

const bookingSlotRescheduleFieldsSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().min(1).max(48),
});

export const guestBookingManageRescheduleSchema = guestBookingManageCredentialsSchema.extend(
  bookingSlotRescheduleFieldsSchema.shape,
);

export const accountBookingManageRescheduleSchema = accountBookingManageLookupSchema.extend(
  bookingSlotRescheduleFieldsSchema.shape,
);
