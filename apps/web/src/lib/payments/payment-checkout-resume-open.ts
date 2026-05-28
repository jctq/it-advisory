import { ObjectId } from 'mongodb';
import { COLLECTIONS } from '@/domain/collections';
import type { PaymentGatewayId, PaymentTransactionDocument } from '@/domain/payment-types';
import { getGatewayCredentials, getPaymentSettings } from '@/lib/data/payment-settings';
import {
  findPaymentTransactionById,
  type PaymentTransactionRow,
} from '@/lib/data/payment-transactions';
import { executeSendBookingPaymentReminderEmail } from '@/lib/email/send-booking-payment-reminder-email';
import { buildMarketingBookSessionPath } from '@/lib/marketing/quiz-session-marketing-ref';
import { isOpenPaymentTransactionHoldActive } from '@/lib/marketing/payment-hold-expiry';
import { buildPaymentProviderReturnUrls } from '@/lib/payments/payment-provider-return-urls';
import type { CreateCheckoutSessionResult } from '@/lib/payments/payment-checkout-types';
import { getDb } from '@/lib/mongodb';
import { createMockPaymentAdapter, resolvePaymentAdapter } from '@techmd/payments';

async function updateOpenPaymentTransactionForCheckoutResume(
  transactionId: ObjectId,
  input: {
    readonly gatewayId: PaymentGatewayId;
    readonly amountCentavos: number;
    readonly paymentMethodLabel: string;
    readonly metadata: Record<string, string>;
    readonly customerName: string;
    readonly customerEmail: string;
    readonly customerCompany: string | null;
    readonly customerPhone: string;
  },
): Promise<void> {
  const db = await getDb();
  await db.collection<PaymentTransactionDocument>(COLLECTIONS.paymentTransactions).updateOne(
    { _id: transactionId },
    {
      $set: {
        gatewayId: input.gatewayId,
        amountCentavos: input.amountCentavos,
        paymentMethodLabel: input.paymentMethodLabel,
        metadata: input.metadata,
        customerName: input.customerName,
        customerEmail: input.customerEmail,
        customerCompany: input.customerCompany,
        customerPhone: input.customerPhone,
        redirectUrl: null,
        updatedAt: new Date(),
      },
    },
  );
}

async function updateTransactionProvider(
  transactionId: ObjectId,
  input: {
    readonly providerRef: string;
    readonly providerSessionId: string;
    readonly redirectUrl: string;
  },
): Promise<void> {
  const db = await getDb();
  await db.collection<PaymentTransactionDocument>(COLLECTIONS.paymentTransactions).updateOne(
    { _id: transactionId },
    {
      $set: {
        providerRef: input.providerRef,
        providerSessionId: input.providerSessionId,
        redirectUrl: input.redirectUrl,
        updatedAt: new Date(),
      },
    },
  );
}

/**
 * Reuses an existing open checkout transaction so the payment hold deadline is not extended on every Pay click.
 */
export async function resumeOpenPaymentTransactionCheckout(input: {
  readonly transaction: PaymentTransactionRow;
  readonly visitorId: string;
  readonly gatewayId: PaymentGatewayId;
  readonly paymentMethodId: string;
  readonly paymentMethodLabel: string;
  readonly appBaseUrl: string;
  readonly nativeInAppPaymentReturn?: boolean;
  readonly sessionMarketingRef: string;
  readonly amountCentavos: number;
  readonly metadata: Record<string, string>;
  readonly customerName: string;
  readonly customerEmail: string;
  readonly customerCompany: string | null;
  readonly customerPhone: string;
  readonly bookingStatus: 'pending' | 'confirmed' | 'completed' | 'cancelled' | null;
}): Promise<CreateCheckoutSessionResult> {
  if (input.transaction.visitorId !== input.visitorId) {
    return { ok: false, code: 'transaction_not_found', error: 'Could not load payment session.' };
  }
  if (!isOpenPaymentTransactionHoldActive(input.transaction)) {
    return { ok: false, code: 'payment_hold_expired', error: 'The payment window has expired.' };
  }
  const settings = await getPaymentSettings();
  const transactionObjectId = new ObjectId(input.transaction.id);
  await updateOpenPaymentTransactionForCheckoutResume(transactionObjectId, {
    gatewayId: input.gatewayId,
    amountCentavos: input.amountCentavos,
    paymentMethodLabel: input.paymentMethodLabel,
    metadata: input.metadata,
    customerName: input.customerName,
    customerEmail: input.customerEmail,
    customerCompany: input.customerCompany,
    customerPhone: input.customerPhone,
  });
  const credentials = await getGatewayCredentials(input.gatewayId);
  const useMock = credentials === null && process.env.NODE_ENV === 'development';
  const { successUrl, cancelUrl } = buildPaymentProviderReturnUrls({
    appBaseUrl: input.appBaseUrl,
    transactionId: input.transaction.id,
    nativeInAppPaymentReturn: input.nativeInAppPaymentReturn === true,
    cancelRelativeUrl: `${buildMarketingBookSessionPath(input.sessionMarketingRef)}?payment=cancelled`,
    sessionMarketingRef: input.sessionMarketingRef,
  });
  const adapter =
    useMock
      ? createMockPaymentAdapter(successUrl)
      : credentials !== null
        ? resolvePaymentAdapter(input.gatewayId, credentials)
        : null;
  if (adapter === null) {
    return { ok: false, code: 'gateway_not_configured', error: 'Payment gateway credentials are not configured.' };
  }
  let providerSession: { readonly providerRef: string; readonly providerSessionId: string; readonly redirectUrl: string };
  try {
    providerSession = await adapter.createCheckoutSession({
      amountCentavos: input.amountCentavos,
      currency: 'PHP',
      description: 'TechMD Consultation Booking',
      successUrl,
      cancelUrl,
      referenceId: input.transaction.bookingDraftId,
      metadata: {
        transactionId: input.transaction.id,
        visitorId: input.visitorId,
        bookingDraftId: input.transaction.bookingDraftId,
        paymentMethodId: input.paymentMethodId,
        ...(input.transaction.bookingId !== null ? { bookingId: input.transaction.bookingId } : {}),
      },
      sandboxMode: settings.sandboxMode,
      paymentMethodId: input.paymentMethodId,
      customerName: input.customerName,
      customerEmail: input.customerEmail,
      customerPhone: input.customerPhone,
    });
  } catch (error: unknown) {
    return {
      ok: false,
      code: 'gateway_error',
      error: error instanceof Error ? error.message : 'Payment provider error.',
    };
  }
  await updateTransactionProvider(transactionObjectId, providerSession);
  const refreshed = await findPaymentTransactionById(input.transaction.id, input.visitorId);
  if (refreshed !== null) {
    void executeSendBookingPaymentReminderEmail({ transaction: refreshed });
  }
  return {
    ok: true,
    transactionId: input.transaction.id,
    redirectUrl: providerSession.redirectUrl,
    bookingId: input.transaction.bookingId,
    manualConfirm: false,
    mock: useMock,
    bookingStatus: input.bookingStatus,
  };
}
