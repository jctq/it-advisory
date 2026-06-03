import { NextResponse } from 'next/server';
import { jsonApiValidationError } from '@/lib/server/api-error-response';
import { z } from 'zod';
import type { BookingDocument } from '@/domain/types';
import {
  countBookingsByDiagnosticSessionId,
  createBookingWithLatestDiagnosticSnapshot,
  findBookingById,
  findBookingByVisitorSlot,
  linkDiagnosticSessionToVisitorBooking,
} from '@/lib/data/bookings';
import { isMarketingSlotInPublishedAvailabilityForCheckout } from '@/lib/data/booking-availability';
import { insertMarketingBookingLead, type MarketingBookingLeadContact } from '@/lib/data/leads';
import { parseBookingSlotToUtc } from '@/lib/marketing/booking-slot';
import { PRIMARY_TIMEZONE } from '@/lib/timezone';
import { resolveMarketingVisitorId } from '@/lib/server/marketing-visitor-id';
import { getPaymentSettings } from '@/lib/data/payment-settings';
import {
  findDiagnosticSessionForVisitor,
  markDiagnosticSessionCompleteIfGuided,
} from '@/lib/data/diagnostic-sessions';
import { extractGuidedDiagnosticRawFromDiagnosticAnswers } from '@/lib/marketing/extract-guided-diagnostic-raw';
import { resolveDiagnosticSessionObjectIdHexFromMarketingRef } from '@/lib/server/diagnostic-session-marketing-ref-crypto';
import { executeRateLimitOrResponse } from '@/lib/server/rate-limit';

const PAYMENT_METHOD_IDS = ['card', 'gcash', 'maya', 'bank_transfer', 'paypal'] as const;

type PaymentMethodId = (typeof PAYMENT_METHOD_IDS)[number];

function resolvePaymentMethodLabel(method: PaymentMethodId): string {
  const labels: Record<PaymentMethodId, string> = {
    card: 'Credit / Debit Card',
    gcash: 'GCash',
    maya: 'Maya',
    bank_transfer: 'Bank transfer',
    paypal: 'PayPal',
  };
  return labels[method];
}

async function resolveBookingStatusForId(
  bookingId: string,
): Promise<BookingDocument['status'] | null> {
  const row = await findBookingById(bookingId);
  return row?.status ?? null;
}

const postBodySchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    time: z.string().min(1).max(48),
    serviceKey: z.string().min(1).max(120).default('project-rescue'),
    diagnosticSessionId: z.string().min(1).max(512),
    customerName: z.string().min(1).max(200).optional(),
    customerEmail: z.string().email().max(320).optional(),
    customerCompany: z.string().max(200).optional(),
    customerPhone: z.string().min(1).max(50).optional(),
    paymentMethod: z.enum(PAYMENT_METHOD_IDS).optional(),
  })
  .superRefine((data, ctx) => {
    const hasAny =
      (data.customerName?.trim().length ?? 0) > 0 ||
      (data.customerEmail?.trim().length ?? 0) > 0 ||
      (data.customerPhone?.trim().length ?? 0) > 0 ||
      data.paymentMethod !== undefined;
    if (!hasAny) {
      return;
    }
    if ((data.customerName?.trim().length ?? 0) === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Full name is required', path: ['customerName'] });
    }
    if ((data.customerEmail?.trim().length ?? 0) === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Email is required', path: ['customerEmail'] });
    }
    if ((data.customerPhone?.trim().length ?? 0) === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Phone is required', path: ['customerPhone'] });
    }
    if (data.paymentMethod === undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Payment method is required', path: ['paymentMethod'] });
    }
  });

/**
 * Persists a marketing booking and copies the latest diagnostic (full rounds, questions, options) for admin CRM.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const rateLimited = await executeRateLimitOrResponse(request, 'booking_create');
  if (rateLimited !== null) {
    return rateLimited;
  }
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const parsed = postBodySchema.safeParse(json);
  if (!parsed.success) {
    return jsonApiValidationError(parsed.error);
  }
  const resolvedDiagnosticSession = resolveDiagnosticSessionObjectIdHexFromMarketingRef(parsed.data.diagnosticSessionId);
  if (resolvedDiagnosticSession === null) {
    return NextResponse.json({ error: 'Invalid diagnostic session reference', code: 'diagnostic_session_invalid_id' }, { status: 400 });
  }
  const diagnosticSessionIdHex = resolvedDiagnosticSession;
  const visitorId = await resolveMarketingVisitorId(request);
  const ownedDiagnosticSession = await findDiagnosticSessionForVisitor(visitorId, diagnosticSessionIdHex);
  if (ownedDiagnosticSession === null) {
    return NextResponse.json(
      {
        error: 'This diagnostic was not found or you no longer have access to it.',
        code: 'diagnostic_session_not_found',
      },
      { status: 404 },
    );
  }
  if (ownedDiagnosticSession._id !== undefined) {
    const existingBookingCount = await countBookingsByDiagnosticSessionId(ownedDiagnosticSession._id);
    if (existingBookingCount > 0) {
      return NextResponse.json(
        {
          error: 'This diagnostic is already linked to a booking.',
          code: 'diagnostic_session_already_booked',
        },
        { status: 409 },
      );
    }
  }
  let startsAt: Date;
  try {
    startsAt = parseBookingSlotToUtc(parsed.data.date, parsed.data.time);
  } catch {
    return NextResponse.json({ error: 'Invalid date or time' }, { status: 400 });
  }
  const serviceKey = parsed.data.serviceKey;
  const paymentSettings = await getPaymentSettings();
  const hasFullCheckout =
    parsed.data.customerName !== undefined &&
    parsed.data.customerName.trim().length > 0 &&
    parsed.data.customerEmail !== undefined &&
    parsed.data.customerEmail.trim().length > 0 &&
    parsed.data.customerPhone !== undefined &&
    parsed.data.customerPhone.trim().length > 0 &&
    parsed.data.paymentMethod !== undefined;
  if (hasFullCheckout && paymentSettings.paymentsEnabled) {
    return NextResponse.json(
      {
        error: 'Use the payment checkout API to complete this booking.',
        code: 'payments_checkout_required',
      },
      { status: 400 },
    );
  }
  const checkoutContact: MarketingBookingLeadContact | null = hasFullCheckout
    ? {
        name: parsed.data.customerName!.trim(),
        email: parsed.data.customerEmail!.trim(),
        company: parsed.data.customerCompany?.trim() ?? '',
        phone: parsed.data.customerPhone!.trim(),
      }
    : null;
  const paymentMethodLabel =
    parsed.data.paymentMethod !== undefined ? resolvePaymentMethodLabel(parsed.data.paymentMethod) : null;
  const existingId = await findBookingByVisitorSlot({ visitorId, serviceKey, startsAt });
  if (existingId !== null) {
    const linked = await linkDiagnosticSessionToVisitorBooking({
      bookingId: existingId,
      visitorId,
      diagnosticSessionIdHex,
    });
    if (!linked) {
      return NextResponse.json(
        { error: 'Could not link this diagnostic to the existing reservation.', code: 'diagnostic_link_failed' },
        { status: 400 },
      );
    }
    return NextResponse.json({
      ok: true as const,
      bookingId: existingId.toString(),
      deduped: true as const,
      diagnosticSessionLinked: true as const,
      startsAtIso: startsAt.toISOString(),
      timezone: PRIMARY_TIMEZONE,
      bookingStatus: await resolveBookingStatusForId(existingId.toString()),
    });
  }
  const slotOk = await isMarketingSlotInPublishedAvailabilityForCheckout({
    serviceKey,
    startsAtUtc: startsAt,
    diagnosticSessionIdHex,
    visitorId,
  });
  if (!slotOk) {
    return NextResponse.json(
      { error: 'This time is no longer available.', code: 'booking_slot_unavailable' },
      { status: 409 },
    );
  }
  const leadId = await insertMarketingBookingLead(visitorId, checkoutContact);
  if (leadId === null) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }
  const created = await createBookingWithLatestDiagnosticSnapshot({
    visitorId,
    serviceKey,
    startsAt,
    timezone: PRIMARY_TIMEZONE,
    leadId,
    preferredDiagnosticSessionId: diagnosticSessionIdHex,
    paymentMethodLabel,
  });
  if (created === 'diagnostic_session_not_accessible') {
    return NextResponse.json(
      {
        error: 'This diagnostic was not found or you no longer have access to it.',
        code: 'diagnostic_session_not_found',
      },
      { status: 404 },
    );
  }
  if (created === 'duplicate_key') {
    return NextResponse.json(
      { error: 'This time is no longer available.', code: 'booking_slot_unavailable' },
      { status: 409 },
    );
  }
  if (created === null) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }
  if (created.diagnosticSessionId !== null) {
    const snapshot =
      ownedDiagnosticSession.answers !== undefined
        ? extractGuidedDiagnosticRawFromDiagnosticAnswers(ownedDiagnosticSession.answers)
        : null;
    await markDiagnosticSessionCompleteIfGuided({
      sessionId: created.diagnosticSessionId,
      guidedDiagnosticRaw: snapshot,
    });
  }
  return NextResponse.json({
    ok: true as const,
    bookingId: created.bookingId.toString(),
    deduped: false as const,
    startsAtIso: startsAt.toISOString(),
    timezone: PRIMARY_TIMEZONE,
    bookingStatus: await resolveBookingStatusForId(created.bookingId.toString()),
  });
}
