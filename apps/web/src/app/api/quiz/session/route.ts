import { NextResponse } from 'next/server';
import { z } from 'zod';
import { countBookingsByQuizSessionId, findPrimaryBookingSlotByQuizSessionId } from '@/lib/data/bookings';
import { findLatestPaymentTransactionByQuizSessionIdHex } from '@/lib/data/payment-transactions';
import { getPaymentSettingsPublicView } from '@/lib/data/payment-settings';
import { resolvePaymentHoldExpiresAtIso } from '@/lib/marketing/payment-hold-expiry';
import { resolvePaymentSelectionFromTransaction } from '@/lib/marketing/resolve-payment-selection-from-transaction';
import { syncQuizSessionPaymentHold } from '@/lib/payments/sync-quiz-session-payment-hold';
import {
  deleteQuizSessionForVisitor,
  findLatestQuizSession,
  findQuizSessionForVisitor,
  insertBlankQuizSessionForVisitor,
  upsertQuizProgress,
} from '@/lib/data/quiz-sessions';
import { resolveMarketingVisitorId } from '@/lib/server/marketing-visitor-id';
import {
  encodeQuizSessionRefForMarketingUrl,
  resolveQuizSessionObjectIdHexFromMarketingRef,
} from '@/lib/server/quiz-session-marketing-ref-crypto';

const patchBodySchema = z.object({
  answers: z.record(z.union([z.string(), z.number(), z.boolean(), z.array(z.string())])),
  currentStep: z.number().int().min(0),
  completed: z.boolean().optional(),
  sessionId: z.string().min(1).max(512).optional(),
});

type OptionalSessionIdQuery =
  | { readonly status: 'absent' }
  | { readonly status: 'invalid' }
  | { readonly status: 'ok'; readonly objectIdHex: string };

function parseSessionIdQuery(request: Request): OptionalSessionIdQuery {
  const raw = new URL(request.url).searchParams.get('sessionId')?.trim() ?? '';
  if (raw.length === 0) {
    return { status: 'absent' };
  }
  const objectIdHex = resolveQuizSessionObjectIdHexFromMarketingRef(raw);
  if (objectIdHex === null) {
    return { status: 'invalid' };
  }
  return { status: 'ok', objectIdHex };
}

export async function GET(request: Request): Promise<NextResponse> {
  const visitorId = await resolveMarketingVisitorId(request);
  const parsedId = parseSessionIdQuery(request);
  if (parsedId.status === 'invalid') {
    return NextResponse.json({ error: 'Invalid sessionId', code: 'quiz_session_invalid_id' }, { status: 400 });
  }
  const session =
    parsedId.status === 'ok'
      ? await findQuizSessionForVisitor(visitorId, parsedId.objectIdHex)
      : await findLatestQuizSession(visitorId);
  if (parsedId.status === 'ok' && session === null) {
    return NextResponse.json({ error: 'Session not found', code: 'quiz_session_not_found' }, { status: 404 });
  }
  if (!session) {
    return NextResponse.json({
      session: null,
      sessionId: null,
    });
  }
  if (session._id === undefined) {
    return NextResponse.json({
      session: {
        answers: session.answers,
        currentStep: session.currentStep,
      },
      readOnly: false,
      sessionId: null,
    });
  }
  const sessionIdHex = session._id.toString();
  await syncQuizSessionPaymentHold({ quizSessionIdHex: sessionIdHex, visitorId });
  const bookedCount = await countBookingsByQuizSessionId(session._id);
  const linkedBookingSlot =
    bookedCount > 0 ? await findPrimaryBookingSlotByQuizSessionId(session._id) : null;
  const latestPayment = await findLatestPaymentTransactionByQuizSessionIdHex(sessionIdHex);
  const hasPendingCheckout =
    latestPayment !== null &&
    (latestPayment.status === 'pending' || latestPayment.status === 'processing');
  const pendingCheckout =
    hasPendingCheckout && linkedBookingSlot === null
      ? {
          transactionId: latestPayment.id,
          startsAtIso: latestPayment.startsAtIso,
          timezone: latestPayment.timezone,
          serviceKey: latestPayment.serviceKey,
          customerName: latestPayment.customerName,
          customerEmail: latestPayment.customerEmail,
          customerCompany: latestPayment.customerCompany,
          customerPhone: latestPayment.customerPhone,
          expiresAtIso: latestPayment.expiresAtIso,
          bookingId: latestPayment.bookingId,
        }
      : null;
  const serverNowIso = new Date().toISOString();
  const paymentSettings = await getPaymentSettingsPublicView();
  const paymentHoldExpiresAtIso =
    hasPendingCheckout || (linkedBookingSlot !== null && linkedBookingSlot.status === 'pending')
      ? resolvePaymentHoldExpiresAtIso({
          bookingPaymentExpiresAtIso: linkedBookingSlot?.paymentExpiresAtIso ?? null,
          transactionExpiresAtIso: latestPayment?.expiresAtIso ?? null,
          transactionCreatedAtIso: latestPayment?.createdAtIso ?? null,
          holdExpiresMinutes: paymentSettings.holdExpiresMinutes,
        })
      : null;
  const isAwaitingPaymentResume =
    latestPayment !== null &&
    (latestPayment.status === 'pending' || latestPayment.status === 'processing') &&
    ((hasPendingCheckout && linkedBookingSlot === null) ||
      (linkedBookingSlot !== null &&
        linkedBookingSlot.status === 'pending' &&
        linkedBookingSlot.paymentStatus !== 'paid'));
  const resumePaymentSelection = isAwaitingPaymentResume
    ? resolvePaymentSelectionFromTransaction(latestPayment)
    : null;
  return NextResponse.json({
    session: {
      answers: session.answers,
      currentStep: session.currentStep,
    },
    readOnly: bookedCount > 0 || hasPendingCheckout,
    serverNowIso,
    paymentHoldExpiresAtIso,
    resumePaymentSelection,
    sessionId: encodeQuizSessionRefForMarketingUrl(sessionIdHex),
    pendingCheckout,
    linkedBookingSlot:
      linkedBookingSlot === null
        ? null
        : {
            bookingId: linkedBookingSlot.bookingId,
            status: linkedBookingSlot.status,
            startsAtIso: linkedBookingSlot.startsAtIso,
            timezone: linkedBookingSlot.timezone,
            serviceKey: linkedBookingSlot.serviceKey,
            meetingUrl: linkedBookingSlot.meetingUrl,
            paymentTransactionId: linkedBookingSlot.paymentTransactionId,
            paymentMethodLabel: linkedBookingSlot.paymentMethodLabel,
            paymentStatus: linkedBookingSlot.paymentStatus,
            customerName: linkedBookingSlot.customerName,
            customerEmail: linkedBookingSlot.customerEmail,
            customerCompany: linkedBookingSlot.customerCompany,
            customerPhone: linkedBookingSlot.customerPhone,
            paymentExpiresAtIso: linkedBookingSlot.paymentExpiresAtIso,
          },
  });
}

export async function PATCH(request: Request): Promise<NextResponse> {
  const visitorId = await resolveMarketingVisitorId(request);
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const parsed = patchBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }
  const { answers, currentStep, completed, sessionId: sessionIdRaw } = parsed.data;
  let resolvedTargetSessionHex: string | undefined;
  if (sessionIdRaw !== undefined) {
    const resolved = resolveQuizSessionObjectIdHexFromMarketingRef(sessionIdRaw);
    if (resolved === null) {
      return NextResponse.json({ error: 'Invalid sessionId', code: 'quiz_session_invalid_id' }, { status: 400 });
    }
    resolvedTargetSessionHex = resolved;
  }
  let targetForBooking: Awaited<ReturnType<typeof findLatestQuizSession>> = null;
  if (resolvedTargetSessionHex !== undefined) {
    targetForBooking = await findQuizSessionForVisitor(visitorId, resolvedTargetSessionHex);
  } else {
    targetForBooking = await findLatestQuizSession(visitorId);
  }
  if (targetForBooking !== null && targetForBooking._id !== undefined) {
    const bookedCount = await countBookingsByQuizSessionId(targetForBooking._id);
    if (bookedCount > 0) {
      return NextResponse.json(
        {
          error: 'This diagnostic is linked to a booking and cannot be edited.',
          code: 'quiz_session_read_only',
        },
        { status: 403 },
      );
    }
  }
  const result = await upsertQuizProgress({
    visitorId,
    answers,
    currentStep,
    isComplete: completed ?? false,
    targetSessionId: resolvedTargetSessionHex,
  });
  if (!result.persisted && resolvedTargetSessionHex !== undefined) {
    return NextResponse.json({ error: 'Session not found', code: 'quiz_session_not_found' }, { status: 404 });
  }
  return NextResponse.json({
    sessionId:
      result.sessionId !== undefined ? encodeQuizSessionRefForMarketingUrl(result.sessionId) : null,
    persisted: result.persisted,
  });
}

export async function DELETE(request: Request): Promise<NextResponse> {
  const visitorId = await resolveMarketingVisitorId(request);
  const parsedId = parseSessionIdQuery(request);
  if (parsedId.status === 'invalid') {
    return NextResponse.json({ error: 'Invalid sessionId', code: 'quiz_session_invalid_id' }, { status: 400 });
  }
  if (parsedId.status === 'ok') {
    const outcome = await deleteQuizSessionForVisitor(visitorId, parsedId.objectIdHex);
    if (outcome.ok === false) {
      if (outcome.code === 'has_booking') {
        return NextResponse.json(
          {
            error: 'This diagnostic is linked to a booking and cannot be deleted.',
            code: 'quiz_session_has_booking',
          },
          { status: 409 },
        );
      }
      return NextResponse.json({ error: 'Session not found', code: 'quiz_session_not_found' }, { status: 404 });
    }
    return NextResponse.json({
      deleted: true as const,
      sessionId: encodeQuizSessionRefForMarketingUrl(parsedId.objectIdHex),
    });
  }
  const latestSession = await findLatestQuizSession(visitorId);

  if (!latestSession) {
    return NextResponse.json({
      persisted: false,
      reset: false,
      sessionId: null,
    });
  }
  if (latestSession._id !== undefined) {
    const bookedCount = await countBookingsByQuizSessionId(latestSession._id);
    if (bookedCount > 0) {
      /**
       * Latest row is the diagnostic captured at checkout — it must stay in Mongo for CRM. Point the visitor at a
       * new blank session so guests (and signed-in users) can start another diagnostic from home or `/diagnostic` after
       * booking without reusing the read-only snapshot.
       */
      const newSessionHex = await insertBlankQuizSessionForVisitor(visitorId);
      if (newSessionHex === null) {
        return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
      }
      return NextResponse.json({
        persisted: true,
        reset: true,
        sessionId: encodeQuizSessionRefForMarketingUrl(newSessionHex),
      });
    }
  }

  if (latestSession._id === undefined) {
    return NextResponse.json({
      persisted: false,
      reset: false,
      sessionId: null,
    });
  }
  const outcome = await deleteQuizSessionForVisitor(visitorId, latestSession._id.toString());
  if (outcome.ok === false) {
    return NextResponse.json({ error: 'Session not found', code: 'quiz_session_not_found' }, { status: 404 });
  }
  return NextResponse.json({
    deleted: true as const,
    sessionId: encodeQuizSessionRefForMarketingUrl(latestSession._id.toString()),
  });
}
