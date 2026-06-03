import { NextResponse } from 'next/server';
import { jsonApiValidationError } from '@/lib/server/api-error-response';
import { z } from 'zod';
import { countBookingsByDiagnosticSessionId, findPrimaryBookingSlotByDiagnosticSessionId } from '@/lib/data/bookings';
import { findLatestPaymentTransactionByDiagnosticSessionIdHex } from '@/lib/data/payment-transactions';
import { getPaymentSettingsPublicView } from '@/lib/data/payment-settings';
import { resolvePaymentHoldExpiresAtIso } from '@/lib/marketing/payment-hold-expiry';
import { resolvePaymentSelectionFromTransaction } from '@/lib/marketing/resolve-payment-selection-from-transaction';
import { isDiagnosticSessionEditingLocked } from '@/lib/marketing/diagnostic-session-edit-lock';
import { reconcileDiagnosticSessionPaidBookingLink } from '@/lib/payments/reconcile-diagnostic-session-paid-booking-link';
import { syncDiagnosticSessionPaymentHold } from '@/lib/payments/sync-diagnostic-session-payment-hold';
import {
  deleteDiagnosticSessionForVisitor,
  findBookingGuidedSnapshotForDiagnosticSession,
  findLatestDiagnosticSession,
  findDiagnosticSessionForVisitor,
  insertBlankDiagnosticSessionForVisitor,
  repairDiagnosticSessionAnswersFromBookingSnapshot,
  syncVisitorDiagnosticCompletion,
  upsertDiagnosticProgress,
} from '@/lib/data/diagnostic-sessions';
import { resolveMarketingVisitorId } from '@/lib/server/marketing-visitor-id';
import { parseRecordingOptInFromTransactionMetadata } from '@/lib/booking/apply-booking-recording-fields';
import { resolvePaymentStatusForCustomerLifecycle } from '@/lib/payments/payment-checkout-commit';
import {
  encodeDiagnosticSessionRefForMarketingUrl,
  resolveDiagnosticSessionObjectIdHexFromMarketingRef,
} from '@/lib/server/diagnostic-session-marketing-ref-crypto';
import { executeRateLimitOrResponse } from '@/lib/server/rate-limit';

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
  const objectIdHex = resolveDiagnosticSessionObjectIdHexFromMarketingRef(raw);
  if (objectIdHex === null) {
    return { status: 'invalid' };
  }
  return { status: 'ok', objectIdHex };
}

export async function GET(request: Request): Promise<NextResponse> {
  const visitorId = await resolveMarketingVisitorId(request);
  await syncVisitorDiagnosticCompletion(visitorId);
  const parsedId = parseSessionIdQuery(request);
  if (parsedId.status === 'invalid') {
    return NextResponse.json({ error: 'Invalid sessionId', code: 'diagnostic_session_invalid_id' }, { status: 400 });
  }
  const session =
    parsedId.status === 'ok'
      ? await findDiagnosticSessionForVisitor(visitorId, parsedId.objectIdHex)
      : await findLatestDiagnosticSession(visitorId);
  if (parsedId.status === 'ok' && session === null) {
    return NextResponse.json({ error: 'Session not found', code: 'diagnostic_session_not_found' }, { status: 404 });
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
  const serverNow = new Date();
  await syncDiagnosticSessionPaymentHold({ diagnosticSessionIdHex: sessionIdHex, visitorId, now: serverNow });
  await reconcileDiagnosticSessionPaidBookingLink({ diagnosticSessionIdHex: sessionIdHex, visitorId });
  const bookedCount = await countBookingsByDiagnosticSessionId(session._id);
  const bookingSnapshotRaw = await findBookingGuidedSnapshotForDiagnosticSession(session._id);
  const clientAnswers = await repairDiagnosticSessionAnswersFromBookingSnapshot({
    sessionId: session._id,
    visitorId,
    sessionAnswers: session.answers,
    bookingSnapshotRaw,
  });
  const linkedBookingSlot =
    bookedCount > 0 ? await findPrimaryBookingSlotByDiagnosticSessionId(session._id) : null;
  const latestPayment = await findLatestPaymentTransactionByDiagnosticSessionIdHex(sessionIdHex);
  const committedPaymentStatus = resolvePaymentStatusForCustomerLifecycle(
    latestPayment?.status ?? null,
    latestPayment?.metadata,
  );
  const hasOpenPaymentTransaction =
    committedPaymentStatus === 'pending' || committedPaymentStatus === 'processing';
  const hasPendingCheckout = hasOpenPaymentTransaction && linkedBookingSlot === null;
  const pendingCheckout =
    hasPendingCheckout && latestPayment !== null
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
          recordingOptIn: parseRecordingOptInFromTransactionMetadata(latestPayment.metadata),
        }
      : null;
  const serverNowIso = serverNow.toISOString();
  const paymentSettings = await getPaymentSettingsPublicView();
  const paymentHoldExpiresAtIso =
    hasOpenPaymentTransaction || (linkedBookingSlot !== null && linkedBookingSlot.status === 'pending')
      ? resolvePaymentHoldExpiresAtIso({
          bookingPaymentExpiresAtIso: linkedBookingSlot?.paymentExpiresAtIso ?? null,
          transactionExpiresAtIso: latestPayment?.expiresAtIso ?? null,
          transactionCreatedAtIso: latestPayment?.createdAtIso ?? null,
          holdExpiresMinutes: paymentSettings.holdExpiresMinutes,
        })
      : null;
  const paymentHoldClosed =
    paymentHoldExpiresAtIso !== null && Date.parse(paymentHoldExpiresAtIso) <= serverNow.getTime();
  const linkedPendingUnpaid =
    linkedBookingSlot !== null &&
    linkedBookingSlot.status === 'pending' &&
    linkedBookingSlot.paymentStatus !== 'paid' &&
    hasOpenPaymentTransaction;
  const isAwaitingPaymentResume =
    !paymentHoldClosed && (hasPendingCheckout || linkedPendingUnpaid);
  const resumePaymentSelection =
    isAwaitingPaymentResume && latestPayment !== null
      ? resolvePaymentSelectionFromTransaction(latestPayment)
      : null;
  const latestPaymentTransactionStatus = committedPaymentStatus;
  const latestPaymentTransactionId = latestPayment?.id ?? null;
  const readOnly = isDiagnosticSessionEditingLocked({
    bookedCount,
    latestPaymentStatus: committedPaymentStatus,
  });
  return NextResponse.json({
    session: {
      answers: clientAnswers,
      currentStep: session.currentStep,
    },
    readOnly,
    serverNowIso,
    paymentHoldExpiresAtIso,
    canResumePaymentCheckout: isAwaitingPaymentResume,
    latestPaymentTransactionStatus,
    latestPaymentTransactionId,
    resumePaymentSelection,
    sessionId: encodeDiagnosticSessionRefForMarketingUrl(sessionIdHex),
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
            recordingOptIn: linkedBookingSlot.recordingOptIn,
          },
  });
}

export async function PATCH(request: Request): Promise<NextResponse> {
  const rateLimited = await executeRateLimitOrResponse(request, 'diagnostic_session');
  if (rateLimited !== null) {
    return rateLimited;
  }
  const visitorId = await resolveMarketingVisitorId(request);
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const parsed = patchBodySchema.safeParse(json);
  if (!parsed.success) {
    return jsonApiValidationError(parsed.error);
  }
  const { answers, currentStep, completed, sessionId: sessionIdRaw } = parsed.data;
  let resolvedTargetSessionHex: string | undefined;
  if (sessionIdRaw !== undefined) {
    const resolved = resolveDiagnosticSessionObjectIdHexFromMarketingRef(sessionIdRaw);
    if (resolved === null) {
      return NextResponse.json({ error: 'Invalid sessionId', code: 'diagnostic_session_invalid_id' }, { status: 400 });
    }
    resolvedTargetSessionHex = resolved;
  }
  let targetForBooking: Awaited<ReturnType<typeof findLatestDiagnosticSession>> = null;
  if (resolvedTargetSessionHex !== undefined) {
    targetForBooking = await findDiagnosticSessionForVisitor(visitorId, resolvedTargetSessionHex);
  } else {
    targetForBooking = await findLatestDiagnosticSession(visitorId);
  }
  if (targetForBooking !== null && targetForBooking._id !== undefined) {
    const bookedCount = await countBookingsByDiagnosticSessionId(targetForBooking._id);
    const latestPayment = await findLatestPaymentTransactionByDiagnosticSessionIdHex(
      targetForBooking._id.toString(),
    );
    const committedPaymentStatus = resolvePaymentStatusForCustomerLifecycle(
      latestPayment?.status ?? null,
      latestPayment?.metadata,
    );
    if (
      isDiagnosticSessionEditingLocked({
        bookedCount,
        latestPaymentStatus: committedPaymentStatus,
      })
    ) {
      return NextResponse.json(
        {
          error: 'This diagnostic is linked to a booking and cannot be edited.',
          code: 'diagnostic_session_read_only',
        },
        { status: 403 },
      );
    }
  }
  const result = await upsertDiagnosticProgress({
    visitorId,
    answers,
    currentStep,
    isComplete: completed ?? false,
    targetSessionId: resolvedTargetSessionHex,
  });
  if (!result.persisted && resolvedTargetSessionHex !== undefined) {
    return NextResponse.json({ error: 'Session not found', code: 'diagnostic_session_not_found' }, { status: 404 });
  }
  return NextResponse.json({
    sessionId:
      result.sessionId !== undefined ? encodeDiagnosticSessionRefForMarketingUrl(result.sessionId) : null,
    persisted: result.persisted,
  });
}

export async function DELETE(request: Request): Promise<NextResponse> {
  const rateLimited = await executeRateLimitOrResponse(request, 'diagnostic_session');
  if (rateLimited !== null) {
    return rateLimited;
  }
  const visitorId = await resolveMarketingVisitorId(request);
  const parsedId = parseSessionIdQuery(request);
  if (parsedId.status === 'invalid') {
    return NextResponse.json({ error: 'Invalid sessionId', code: 'diagnostic_session_invalid_id' }, { status: 400 });
  }
  if (parsedId.status === 'ok') {
    const outcome = await deleteDiagnosticSessionForVisitor(visitorId, parsedId.objectIdHex);
    if (outcome.ok === false) {
      return NextResponse.json({ error: 'Session not found', code: 'diagnostic_session_not_found' }, { status: 404 });
    }
    return NextResponse.json({
      deleted: true as const,
      sessionId: encodeDiagnosticSessionRefForMarketingUrl(parsedId.objectIdHex),
    });
  }
  const latestSession = await findLatestDiagnosticSession(visitorId);

  if (!latestSession) {
    return NextResponse.json({
      persisted: false,
      reset: false,
      sessionId: null,
    });
  }
  if (latestSession._id !== undefined) {
    const bookedCount = await countBookingsByDiagnosticSessionId(latestSession._id);
    if (bookedCount > 0) {
      /**
       * Latest row is the diagnostic captured at checkout — it must stay in Mongo for CRM. Point the visitor at a
       * new blank session so guests (and signed-in users) can start another diagnostic from home or `/diagnostic` after
       * booking without reusing the read-only snapshot.
       */
      const newSessionHex = await insertBlankDiagnosticSessionForVisitor(visitorId);
      if (newSessionHex === null) {
        return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
      }
      return NextResponse.json({
        persisted: true,
        reset: true,
        sessionId: encodeDiagnosticSessionRefForMarketingUrl(newSessionHex),
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
  const outcome = await deleteDiagnosticSessionForVisitor(visitorId, latestSession._id.toString());
  if (outcome.ok === false) {
    return NextResponse.json({ error: 'Session not found', code: 'diagnostic_session_not_found' }, { status: 404 });
  }
  return NextResponse.json({
    deleted: true as const,
    sessionId: encodeDiagnosticSessionRefForMarketingUrl(latestSession._id.toString()),
  });
}
