import type { PaymentPolicy } from '@/domain/payment-types';
import type { BookingDocument, LeadDocument } from '@/domain/types';

function readLeadEmail(lead: LeadDocument | null): string {
  if (lead === null || typeof lead.email !== 'string') {
    return '';
  }
  return lead.email.trim().toLowerCase();
}

export type BookingPayabilityCode =
  | 'ok'
  | 'status_confirmed'
  | 'status_cancelled'
  | 'status_not_pending'
  | 'payments_disabled'
  | 'manual_confirm_policy'
  | 'payment_window_expired'
  | 'lead_not_found'
  | 'lead_email_missing'
  | 'visitor_mismatch'
  | 'credentials_mismatch'
  | 'booking_not_found'
  | 'session_slot_in_past';

export type BookingPayabilityResult = {
  readonly code: BookingPayabilityCode;
  readonly canPayOnline: boolean;
  readonly reason: string | null;
  readonly debug: Record<string, unknown>;
};

export type EvaluateBookingPayabilityInput = {
  readonly bookingId: string;
  readonly booking: BookingDocument;
  readonly lead: LeadDocument | null;
  readonly paymentPolicy: PaymentPolicy;
  readonly paymentsEnabled: boolean;
  readonly expectedVisitorId?: string | null;
};

/**
 * Returns whether an existing booking can start online checkout, with a stable reason code for debugging.
 */
export function evaluateBookingPayability(input: EvaluateBookingPayabilityInput): BookingPayabilityResult {
  const nowIso = new Date().toISOString();
  const paymentExpiresAt = input.booking.paymentExpiresAt ?? null;
  const leadEmail = readLeadEmail(input.lead);
  const baseDebug: Record<string, unknown> = {
    bookingId: input.bookingId,
    status: input.booking.status,
    paymentPolicy: input.paymentPolicy,
    paymentsEnabled: input.paymentsEnabled,
    paymentExpiresAtIso: paymentExpiresAt !== null ? paymentExpiresAt.toISOString() : null,
    nowIso,
    visitorIdOnBooking: input.booking.visitorId,
    leadId: input.booking.leadId?.toString() ?? null,
    leadEmailPresent: leadEmail.length > 0,
  };
  if (input.expectedVisitorId !== undefined && input.expectedVisitorId !== null) {
    baseDebug.visitorIdExpected = input.expectedVisitorId;
    baseDebug.visitorIdMatches = input.booking.visitorId === input.expectedVisitorId;
  }
  if (input.booking.status === 'confirmed') {
    return {
      code: 'status_confirmed',
      canPayOnline: false,
      reason: 'This booking is already confirmed.',
      debug: baseDebug,
    };
  }
  if (input.booking.status === 'completed') {
    return {
      code: 'status_not_pending',
      canPayOnline: false,
      reason: 'This booking is already completed.',
      debug: baseDebug,
    };
  }
  if (input.booking.status === 'cancelled') {
    return {
      code: 'status_cancelled',
      canPayOnline: false,
      reason: 'This booking was cancelled.',
      debug: baseDebug,
    };
  }
  if (input.booking.status !== 'pending') {
    return {
      code: 'status_not_pending',
      canPayOnline: false,
      reason: 'This booking cannot be paid online.',
      debug: baseDebug,
    };
  }
  if (!input.paymentsEnabled) {
    return {
      code: 'payments_disabled',
      canPayOnline: false,
      reason: 'Online payment is not available right now. Contact us if you need help.',
      debug: baseDebug,
    };
  }
  if (input.paymentPolicy === 'manual_confirm') {
    return {
      code: 'manual_confirm_policy',
      canPayOnline: false,
      reason: 'Your booking is awaiting manual confirmation. We will email you when it is confirmed.',
      debug: baseDebug,
    };
  }
  if (paymentExpiresAt !== null && paymentExpiresAt.getTime() <= Date.now()) {
    return {
      code: 'payment_window_expired',
      canPayOnline: false,
      reason: 'The payment window for this booking has expired. Contact us to rebook.',
      debug: baseDebug,
    };
  }
  if (input.lead === null) {
    return {
      code: 'lead_not_found',
      canPayOnline: false,
      reason: 'This booking cannot be paid online. Contact support to update your contact details.',
      debug: baseDebug,
    };
  }
  if (leadEmail.length === 0) {
    return {
      code: 'lead_email_missing',
      canPayOnline: false,
      reason: 'This booking is missing a contact email. Contact support to complete payment.',
      debug: baseDebug,
    };
  }
  if (
    input.expectedVisitorId !== undefined &&
    input.expectedVisitorId !== null &&
    input.booking.visitorId !== input.expectedVisitorId
  ) {
    return {
      code: 'visitor_mismatch',
      canPayOnline: false,
      reason: 'This booking cannot be paid online. Check your details or contact support.',
      debug: baseDebug,
    };
  }
  if (input.booking.startsAt.getTime() <= Date.now() && input.booking.paymentStatus !== 'paid') {
    return {
      code: 'session_slot_in_past',
      canPayOnline: false,
      reason: 'Your scheduled consultation time has passed. Pick a new date below or remove this booking.',
      debug: baseDebug,
    };
  }
  return {
    code: 'ok',
    canPayOnline: true,
    reason: null,
    debug: baseDebug,
  };
}

export function shouldIncludePayabilityDebugInResponse(): boolean {
  return process.env.NODE_ENV === 'development' || process.env.BOOKING_PAYABILITY_DEBUG === '1';
}

export function buildPayabilityApiExtras(evaluation: BookingPayabilityResult): {
  readonly payabilityCode: BookingPayabilityCode;
  readonly debug?: Record<string, unknown>;
} {
  if (shouldIncludePayabilityDebugInResponse()) {
    return { payabilityCode: evaluation.code, debug: evaluation.debug };
  }
  return { payabilityCode: evaluation.code };
}

export function buildBookingNotFoundPayability(context: Record<string, unknown>): BookingPayabilityResult {
  return {
    code: 'booking_not_found',
    canPayOnline: false,
    reason: null,
    debug: { ...context, nowIso: new Date().toISOString() },
  };
}

export function buildCredentialsMismatchPayability(context: Record<string, unknown>): BookingPayabilityResult {
  return {
    code: 'credentials_mismatch',
    canPayOnline: false,
    reason: null,
    debug: { ...context, nowIso: new Date().toISOString() },
  };
}

export function buildVisitorMismatchPayability(context: Record<string, unknown>): BookingPayabilityResult {
  return {
    code: 'visitor_mismatch',
    canPayOnline: false,
    reason: 'This booking cannot be paid online. Check your details or contact support.',
    debug: { ...context, nowIso: new Date().toISOString() },
  };
}
