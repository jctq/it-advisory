import { ObjectId } from 'mongodb';
import { COLLECTIONS } from '@/domain/collections';
import type { PaymentPolicy, PaymentStatus } from '@/domain/payment-types';
import type { BookingDocument, LeadDocument } from '@/domain/types';
import { getAppSettings } from '@/lib/data/app-settings';
import { getPaymentSettingsPublicView } from '@/lib/data/payment-settings';
import {
  findLatestPaymentTransactionByQuizSessionIdHex,
  type PaymentTransactionRow,
} from '@/lib/data/payment-transactions';
import { findQuizSessionById } from '@/lib/data/quiz-sessions';
import { formatBookingReferenceId, normalizeBookingReferenceInput } from '@/lib/marketing/booking-reference';
import { MARKETING_QUIZ_SESSION_REF_PREFIX } from '@/lib/marketing/quiz-session-marketing-ref';
import {
  buildMarketingBookSessionPath,
  buildMarketingQuizSessionPath,
} from '@/lib/marketing/quiz-session-marketing-ref';
import { getDb } from '@/lib/mongodb';
import {
  encodeQuizSessionRefForMarketingUrl,
  resolveQuizSessionObjectIdHexFromMarketingRef,
} from '@/lib/server/quiz-session-marketing-ref-crypto';
import {
  evaluateBookingPayability,
  type BookingPayabilityCode,
  type BookingPayabilityResult,
} from '@/lib/payments/evaluate-booking-payability';

export type AdminDiagnosticIssueSeverity = 'error' | 'warn' | 'info';

export type AdminDiagnosticIssue = {
  readonly severity: AdminDiagnosticIssueSeverity;
  readonly code: string;
  readonly title: string;
  readonly message: string;
  readonly debug?: Record<string, unknown>;
};

export type AdminClientDiagnosticBookingRow = {
  readonly bookingId: string;
  readonly bookingReference: string;
  readonly status: BookingDocument['status'];
  readonly visitorId: string;
  readonly serviceKey: string;
  readonly startsAtIso: string;
  readonly timezone: string;
  readonly paymentExpiresAtIso: string | null;
  readonly paymentStatus: string | null;
  readonly quizSessionId: string | null;
  readonly lead: {
    readonly id: string;
    readonly name: string;
    readonly emailPresent: boolean;
    readonly email: string | null;
    readonly phonePresent: boolean;
  };
  readonly payability: BookingPayabilityResult;
  readonly accountOwnerCheckout: BookingPayabilityResult | null;
  readonly issues: readonly AdminDiagnosticIssue[];
  readonly manageBookingUrl: string;
  readonly adminBookingUrl: string;
};

export type AdminClientDiagnosticSessionRow = {
  readonly sessionId: string;
  readonly marketingRef: string;
  readonly visitorId: string;
  readonly currentStep: number;
  readonly createdAtIso: string;
  readonly updatedAtIso: string;
  readonly completedAtIso: string | null;
  readonly hasGuidedDiagnostic: boolean;
  readonly linkedBookingIds: readonly string[];
  readonly latestPaymentTransaction: {
    readonly id: string;
    readonly status: PaymentStatus;
    readonly bookingId: string | null;
    readonly expiresAtIso: string | null;
    readonly paidAtIso: string | null;
  } | null;
  readonly issues: readonly AdminDiagnosticIssue[];
  readonly diagnosticUrl: string;
  readonly bookUrl: string;
  readonly adminSessionUrl: string;
};

export type AdminClientDiagnosticReport = {
  readonly lookup: {
    readonly diagnosticInput: string | null;
    readonly referenceInput: string | null;
    readonly resolvedSessionHex: string | null;
    readonly diagnosticResolveError: string | null;
  };
  readonly platform: {
    readonly paymentsEnabled: boolean;
    readonly paymentPolicy: PaymentPolicy;
    readonly holdExpiresMinutes: number;
    readonly configuredGatewayCount: number;
    readonly manageBookingEnabled: boolean;
    readonly diagnosticAiEnabled: boolean;
    readonly quizUrlSecretConfigured: boolean;
  };
  readonly issues: readonly AdminDiagnosticIssue[];
  readonly sessions: readonly AdminClientDiagnosticSessionRow[];
  readonly bookings: readonly AdminClientDiagnosticBookingRow[];
};

export type RunAdminClientDiagnosticInput = {
  readonly diagnostic?: string | null;
  readonly reference?: string | null;
};

function buildIssue(
  severity: AdminDiagnosticIssueSeverity,
  code: string,
  title: string,
  message: string,
  debug?: Record<string, unknown>,
): AdminDiagnosticIssue {
  return debug !== undefined ? { severity, code, title, message, debug } : { severity, code, title, message };
}

const PAYABILITY_ISSUE_META: Record<
  BookingPayabilityCode,
  { readonly severity: AdminDiagnosticIssueSeverity; readonly title: string }
> = {
  ok: { severity: 'info', title: 'Online payment allowed' },
  status_confirmed: { severity: 'info', title: 'Booking already confirmed' },
  status_cancelled: { severity: 'error', title: 'Booking cancelled' },
  status_not_pending: { severity: 'error', title: 'Booking not pending' },
  payments_disabled: { severity: 'error', title: 'Payments disabled' },
  manual_confirm_policy: { severity: 'warn', title: 'Manual confirm policy' },
  payment_window_expired: { severity: 'error', title: 'Payment window expired' },
  lead_not_found: { severity: 'error', title: 'Lead missing' },
  lead_email_missing: { severity: 'error', title: 'Lead email missing' },
  visitor_mismatch: { severity: 'error', title: 'Visitor mismatch' },
  credentials_mismatch: { severity: 'error', title: 'Guest credentials mismatch' },
  booking_not_found: { severity: 'error', title: 'Booking not found' },
  session_slot_in_past: { severity: 'warn', title: 'Session time in the past' },
};

function issuesFromPayability(result: BookingPayabilityResult, scope: string): AdminDiagnosticIssue[] {
  if (result.code === 'ok') {
    return [
      buildIssue(
        'info',
        `${scope}_payability_ok`,
        PAYABILITY_ISSUE_META.ok.title,
        'All payability checks passed for this scope.',
        result.debug,
      ),
    ];
  }
  const meta = PAYABILITY_ISSUE_META[result.code];
  return [
    buildIssue(
      meta.severity,
      `${scope}_${result.code}`,
      meta.title,
      result.reason ?? `Payability blocked (${result.code}).`,
      result.debug,
    ),
  ];
}

function mapPayabilityForAccountOwner(
  bookingId: string,
  booking: BookingDocument,
  lead: LeadDocument | null,
  paymentPolicy: PaymentPolicy,
  paymentsEnabled: boolean,
): BookingPayabilityResult | null {
  if (!booking.visitorId.startsWith('acct:')) {
    return null;
  }
  return evaluateBookingPayability({
    bookingId,
    booking,
    lead,
    paymentPolicy,
    paymentsEnabled,
    expectedVisitorId: booking.visitorId,
  });
}

async function findBookingDocsByReference(referenceInput: string): Promise<readonly (BookingDocument & { _id: ObjectId })[]> {
  const normalizedReference = normalizeBookingReferenceInput(referenceInput);
  if (normalizedReference.length < 4) {
    return [];
  }
  const escapedReference = normalizedReference.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const db = await getDb();
  const bookingDocs = await db
    .collection<BookingDocument>(COLLECTIONS.bookings)
    .find({
      $expr: {
        $regexMatch: {
          input: { $toString: '$_id' },
          regex: `${escapedReference}$`,
          options: 'i',
        },
      },
    })
    .sort({ createdAt: -1 })
    .limit(20)
    .toArray();
  return bookingDocs.filter((doc): doc is BookingDocument & { _id: ObjectId } => doc._id !== undefined);
}

async function buildBookingRow(
  bookingDoc: BookingDocument & { _id: ObjectId },
  publicSettings: Awaited<ReturnType<typeof getPaymentSettingsPublicView>>,
): Promise<AdminClientDiagnosticBookingRow> {
  const bookingId = bookingDoc._id.toString();
  const db = await getDb();
  const leadDoc =
    bookingDoc.leadId !== undefined
      ? await db.collection<LeadDocument>(COLLECTIONS.leads).findOne({ _id: bookingDoc.leadId })
      : null;
  const payability = evaluateBookingPayability({
    bookingId,
    booking: bookingDoc,
    lead: leadDoc,
    paymentPolicy: publicSettings.paymentPolicy,
    paymentsEnabled: publicSettings.paymentsEnabled,
  });
  const accountOwnerCheckout = mapPayabilityForAccountOwner(
    bookingId,
    bookingDoc,
    leadDoc,
    publicSettings.paymentPolicy,
    publicSettings.paymentsEnabled,
  );
  const issues: AdminDiagnosticIssue[] = [...issuesFromPayability(payability, 'booking')];
  if (accountOwnerCheckout !== null) {
    issues.push(...issuesFromPayability(accountOwnerCheckout, 'account_checkout'));
  }
  const paymentExpiresAt = bookingDoc.paymentExpiresAt ?? null;
  const leadEmail = typeof leadDoc?.email === 'string' ? leadDoc.email.trim() : '';
  if (bookingDoc.startsAt.getTime() < Date.now() && bookingDoc.status === 'pending') {
    issues.push(
      buildIssue(
        'warn',
        'booking_slot_in_past',
        'Consultation time is in the past',
        'The scheduled slot has already passed while the booking is still pending.',
        { startsAtIso: bookingDoc.startsAt.toISOString(), status: bookingDoc.status },
      ),
    );
  }
  if (bookingDoc.quizSessionId === undefined || bookingDoc.quizSessionId === null) {
    issues.push(
      buildIssue(
        'warn',
        'booking_missing_quiz_session',
        'No diagnostic session linked',
        'This booking row has no quizSessionId — checkout and diagnostic flows may not line up.',
      ),
    );
  }
  return {
    bookingId,
    bookingReference: formatBookingReferenceId(bookingId),
    status: bookingDoc.status,
    visitorId: bookingDoc.visitorId,
    serviceKey: bookingDoc.serviceKey,
    startsAtIso: bookingDoc.startsAt.toISOString(),
    timezone: bookingDoc.timezone,
    paymentExpiresAtIso: paymentExpiresAt !== null ? paymentExpiresAt.toISOString() : null,
    paymentStatus:
      bookingDoc.paymentStatus !== undefined && bookingDoc.paymentStatus !== null ? bookingDoc.paymentStatus : null,
    quizSessionId:
      bookingDoc.quizSessionId !== undefined && bookingDoc.quizSessionId !== null
        ? bookingDoc.quizSessionId.toString()
        : null,
    lead: {
      id: leadDoc?._id?.toString() ?? bookingDoc.leadId?.toString() ?? '',
      name: leadDoc?.name ?? '',
      emailPresent: leadEmail.length > 0,
      email: leadEmail.length > 0 ? leadEmail : null,
      phonePresent: typeof leadDoc?.phone === 'string' && leadDoc.phone.trim().length > 0,
    },
    payability,
    accountOwnerCheckout,
    issues,
    manageBookingUrl: `/book/manage?bookingId=${encodeURIComponent(bookingId)}`,
    adminBookingUrl: `/admin/bookings/${encodeURIComponent(bookingId)}`,
  };
}

function mapPaymentTransactionSummary(
  transaction: PaymentTransactionRow | null,
): AdminClientDiagnosticSessionRow['latestPaymentTransaction'] {
  if (transaction === null) {
    return null;
  }
  return {
    id: transaction.id,
    status: transaction.status,
    bookingId: transaction.bookingId,
    expiresAtIso: transaction.expiresAtIso,
    paidAtIso: transaction.paidAtIso,
  };
}

function buildSessionIssues(input: {
  readonly session: NonNullable<Awaited<ReturnType<typeof findQuizSessionById>>>;
  readonly marketingRefInput: string;
  readonly quizUrlSecretConfigured: boolean;
  readonly linkedBookingIds: readonly string[];
  readonly latestTransaction: PaymentTransactionRow | null;
  readonly manageBookingEnabled: boolean;
  readonly hasGuidedDiagnostic: boolean;
}): AdminDiagnosticIssue[] {
  const issues: AdminDiagnosticIssue[] = [];
  const { session } = input;
  if (input.marketingRefInput.trim().startsWith(MARKETING_QUIZ_SESSION_REF_PREFIX) && !input.quizUrlSecretConfigured) {
    issues.push(
      buildIssue(
        'error',
        'quiz_url_secret_missing',
        'Opaque session URL cannot be decoded',
        'QUIZ_SESSION_URL_SECRET is not configured on the server, so qs1.* marketing links will fail for clients.',
      ),
    );
  }
  if (!input.hasGuidedDiagnostic) {
    issues.push(
      buildIssue(
        'warn',
        'session_missing_guided_diagnostic',
        'No guided diagnostic snapshot',
        'The session has no guided diagnostic answers saved — booking may still work but the diagnostic thread is empty.',
      ),
    );
  }
  if (session.completedAtIso === null) {
    issues.push(
      buildIssue(
        'info',
        'session_not_completed',
        'Diagnostic not marked complete',
        'completedAt is not set. The visitor may still be in progress.',
      ),
    );
  }
  if (input.linkedBookingIds.length === 0) {
    issues.push(
      buildIssue(
        'info',
        'session_no_booking',
        'No booking linked',
        'No booking row references this session yet. /book/[sessionRef] should allow a new checkout.',
      ),
    );
  } else if (input.linkedBookingIds.length > 1) {
    issues.push(
      buildIssue(
        'warn',
        'session_multiple_bookings',
        'Multiple bookings linked',
        `${input.linkedBookingIds.length} bookings reference this session. Checkout uses the oldest pending row when payable.`,
        { bookingIds: input.linkedBookingIds },
      ),
    );
  } else {
    issues.push(
      buildIssue(
        'info',
        'session_has_booking',
        'Booking linked',
        'A booking exists for this session. The marketing book flow treats the session as read-only unless paying for a pending slot.',
        { bookingId: input.linkedBookingIds[0] },
      ),
    );
  }
  if (!input.manageBookingEnabled) {
    issues.push(
      buildIssue(
        'warn',
        'manage_booking_disabled',
        'Manage booking disabled',
        'Admin setting diagnosticManageBookingEnabled is off — /book/manage and pay-from-account flows return 403.',
      ),
    );
  }
  const transaction = input.latestTransaction;
  if (transaction !== null) {
    if (transaction.status === 'expired') {
      issues.push(
        buildIssue(
          'error',
          'payment_transaction_expired',
          'Latest payment session expired',
          'The most recent payment transaction for this diagnostic expired before completion.',
          { transactionId: transaction.id },
        ),
      );
    }
    if (transaction.status === 'failed') {
      issues.push(
        buildIssue(
          'error',
          'payment_transaction_failed',
          'Latest payment failed',
          'The most recent payment transaction for this diagnostic failed at the gateway.',
          { transactionId: transaction.id },
        ),
      );
    }
    if (transaction.status === 'paid' && input.linkedBookingIds.length > 0) {
      issues.push(
        buildIssue(
          'info',
          'payment_transaction_paid',
          'Payment marked paid',
          'Latest transaction is paid. Confirm the linked booking status is confirmed.',
          { transactionId: transaction.id, bookingId: transaction.bookingId },
        ),
      );
    }
  }
  return issues;
}

async function buildSessionRow(
  sessionIdHex: string,
  marketingRefInput: string,
  quizUrlSecretConfigured: boolean,
  manageBookingEnabled: boolean,
): Promise<AdminClientDiagnosticSessionRow | null> {
  const session = await findQuizSessionById(sessionIdHex);
  if (session === null) {
    return null;
  }
  let marketingRef: string;
  try {
    marketingRef = encodeQuizSessionRefForMarketingUrl(session.id);
  } catch {
    marketingRef = session.id;
  }
  const linkedBookingIds = session.linkedBookings.map((booking) => booking.id);
  const latestTransaction = await findLatestPaymentTransactionByQuizSessionIdHex(session.id);
  const hasGuidedDiagnostic = session.guidedDiagnosticRaw !== null;
  const issues = buildSessionIssues({
    session,
    marketingRefInput,
    quizUrlSecretConfigured,
    linkedBookingIds,
    latestTransaction,
    manageBookingEnabled,
    hasGuidedDiagnostic,
  });
  return {
    sessionId: session.id,
    marketingRef,
    visitorId: session.visitorId,
    currentStep: session.currentStep,
    createdAtIso: session.createdAtIso,
    updatedAtIso: session.updatedAtIso,
    completedAtIso: session.completedAtIso,
    hasGuidedDiagnostic: session.guidedDiagnosticRaw !== null,
    linkedBookingIds,
    latestPaymentTransaction: mapPaymentTransactionSummary(latestTransaction),
    issues,
    diagnosticUrl: buildMarketingQuizSessionPath(marketingRef),
    bookUrl: buildMarketingBookSessionPath(marketingRef),
    adminSessionUrl: `/admin/sessions/${encodeURIComponent(session.id)}`,
  };
}

/**
 * Admin troubleshooting report for a client diagnostic session and/or booking reference.
 */
export async function runAdminClientDiagnostic(
  input: RunAdminClientDiagnosticInput,
): Promise<AdminClientDiagnosticReport | null> {
  if (!process.env.MONGODB_URI) {
    return null;
  }
  const diagnosticInput = input.diagnostic?.trim() ?? '';
  const referenceInput = input.reference?.trim() ?? '';
  if (diagnosticInput.length === 0 && referenceInput.length === 0) {
    return null;
  }
  const [publicSettings, appSettings] = await Promise.all([getPaymentSettingsPublicView(), getAppSettings()]);
  const quizUrlSecretConfigured =
    (process.env.QUIZ_SESSION_URL_SECRET?.trim() ?? '').length >= 16;
  const platformIssues: AdminDiagnosticIssue[] = [];
  if (!publicSettings.paymentsEnabled) {
    platformIssues.push(
      buildIssue(
        'error',
        'platform_payments_disabled',
        'Payments disabled',
        'paymentsEnabled is false — new online checkouts cannot start.',
      ),
    );
  }
  if (publicSettings.gateways.length === 0) {
    platformIssues.push(
      buildIssue(
        'error',
        'platform_no_gateways',
        'No payment gateways configured',
        'No enabled and configured payment gateways are available for checkout.',
      ),
    );
  }
  const sessionIdSet = new Set<string>();
  const bookingDocById = new Map<string, BookingDocument & { _id: ObjectId }>();
  let resolvedSessionHex: string | null = null;
  let diagnosticResolveError: string | null = null;
  if (diagnosticInput.length > 0) {
    const hex = resolveQuizSessionObjectIdHexFromMarketingRef(diagnosticInput);
    if (hex === null) {
      if (diagnosticInput.startsWith(MARKETING_QUIZ_SESSION_REF_PREFIX)) {
        diagnosticResolveError = 'invalid_opaque_ref';
        platformIssues.push(
          buildIssue(
            'error',
            'diagnostic_invalid_opaque_ref',
            'Invalid or undecodable diagnostic ref',
            'Could not decode the qs1.* marketing ref. Check QUIZ_SESSION_URL_SECRET matches the environment that created the link.',
            { diagnosticInput },
          ),
        );
      } else {
        diagnosticResolveError = 'invalid_format';
        platformIssues.push(
          buildIssue(
            'error',
            'diagnostic_invalid_format',
            'Invalid diagnostic id format',
            'Use a 24-character MongoDB id or a qs1.* marketing session ref from /diagnostic or /book URLs.',
            { diagnosticInput },
          ),
        );
      }
    } else {
      resolvedSessionHex = hex;
      sessionIdSet.add(hex);
      if (/^[a-f\d]{24}$/i.test(diagnosticInput)) {
        const db = await getDb();
        const bookingDoc = await db.collection<BookingDocument>(COLLECTIONS.bookings).findOne({ _id: new ObjectId(hex) });
        if (bookingDoc !== null && bookingDoc._id !== undefined) {
          bookingDocById.set(hex, bookingDoc as BookingDocument & { _id: ObjectId });
        }
      }
      const sessionExists = await findQuizSessionById(hex);
      if (sessionExists === null && diagnosticResolveError === null) {
        diagnosticResolveError = 'session_not_found';
        platformIssues.push(
          buildIssue(
            'error',
            'diagnostic_session_not_found',
            'Diagnostic session not found',
            'No quiz_sessions row exists for this id.',
            { sessionId: hex },
          ),
        );
      }
    }
  }
  if (referenceInput.length > 0) {
    const normalizedReference = normalizeBookingReferenceInput(referenceInput);
    if (normalizedReference.length < 4) {
      platformIssues.push(
        buildIssue(
          'error',
          'reference_too_short',
          'Booking reference too short',
          'Enter at least four characters of the booking reference suffix.',
        ),
      );
    } else {
      const bookingDocs = await findBookingDocsByReference(referenceInput);
      if (bookingDocs.length === 0) {
        platformIssues.push(
          buildIssue(
            'error',
            'reference_not_found',
            'No booking matches reference',
            `No booking id ends with "${normalizedReference}".`,
          ),
        );
      }
      for (const bookingDoc of bookingDocs) {
        const bookingId = bookingDoc._id.toString();
        bookingDocById.set(bookingId, bookingDoc);
        if (bookingDoc.quizSessionId !== undefined && bookingDoc.quizSessionId !== null) {
          sessionIdSet.add(bookingDoc.quizSessionId.toString());
        }
      }
    }
  }
  const sessions: AdminClientDiagnosticSessionRow[] = [];
  for (const sessionIdHex of sessionIdSet) {
    const row = await buildSessionRow(
      sessionIdHex,
      diagnosticInput.length > 0 ? diagnosticInput : sessionIdHex,
      quizUrlSecretConfigured,
      appSettings.diagnosticManageBookingEnabled,
    );
    if (row !== null) {
      sessions.push(row);
    }
  }
  const bookings: AdminClientDiagnosticBookingRow[] = [];
  for (const bookingDoc of bookingDocById.values()) {
    bookings.push(await buildBookingRow(bookingDoc, publicSettings));
  }
  return {
    lookup: {
      diagnosticInput: diagnosticInput.length > 0 ? diagnosticInput : null,
      referenceInput: referenceInput.length > 0 ? referenceInput : null,
      resolvedSessionHex,
      diagnosticResolveError,
    },
    platform: {
      paymentsEnabled: publicSettings.paymentsEnabled,
      paymentPolicy: publicSettings.paymentPolicy,
      holdExpiresMinutes: publicSettings.holdExpiresMinutes,
      configuredGatewayCount: publicSettings.gateways.length,
      manageBookingEnabled: appSettings.diagnosticManageBookingEnabled,
      diagnosticAiEnabled: appSettings.diagnosticAiEnabled,
      quizUrlSecretConfigured,
    },
    issues: platformIssues,
    sessions,
    bookings,
  };
}
