import { ObjectId } from 'mongodb';
import { COLLECTIONS } from '@/domain/collections';
import type { PaymentGatewayId, PaymentTransactionDocument } from '@/domain/payment-types';
import type { CheckoutSessionLineItem } from '@teqmd/payments';
import type { BookingDocument } from '@/domain/types';
import {
  findPaymentTransactionById,
  markPaymentCheckoutCommitted,
} from '@/lib/data/payment-transactions';
import { executeSendBookingPaymentReminderEmail } from '@/lib/email/send-booking-payment-reminder-email';
import { buildMarketingBookSessionPath } from '@/lib/marketing/diagnostic-session-marketing-ref';
import { isOpenPaymentTransactionHoldActive } from '@/lib/marketing/payment-hold-expiry';
import { isPaymentCheckoutCommitted } from '@/lib/payments/payment-checkout-commit';
import { buildPaymentProviderReturnUrls } from '@/lib/payments/payment-provider-return-urls';
import type { CreateCheckoutSessionResult } from '@/lib/payments/payment-checkout-types';
import { getDb } from '@/lib/mongodb';
import type { CheckoutPaymentContext } from '@/lib/payments/payment-checkout-context';
import { timeCheckoutSegment, type CheckoutTimingCollector } from '@/lib/payments/checkout-timing';
import { runProviderCheckout } from '@/lib/payments/run-provider-checkout';
import { updatePaymentTransactionProvider } from '@/lib/payments/update-transaction-provider';

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

/**
 * Reuses an existing open checkout transaction so the payment hold deadline is not extended on every Pay click.
 */
export async function resumeOpenPaymentTransactionCheckout(input: {
  readonly transaction: import('@/lib/data/payment-transactions').PaymentTransactionRow;
  readonly visitorId: string;
  readonly gatewayId: PaymentGatewayId;
  readonly paymentMethodId: string;
  readonly paymentMethodLabel: string;
  readonly appBaseUrl: string;
  readonly nativeInAppPaymentReturn?: boolean;
  readonly sessionMarketingRef: string;
  readonly amountCentavos: number;
  readonly description: string;
  readonly lineItems: readonly CheckoutSessionLineItem[];
  readonly metadata: Record<string, string>;
  readonly customerName: string;
  readonly customerEmail: string;
  readonly customerCompany: string | null;
  readonly customerPhone: string;
  readonly bookingStatus: BookingDocument['status'] | null;
  readonly checkoutContext: CheckoutPaymentContext;
  readonly timing?: CheckoutTimingCollector;
  readonly sendPaymentReminderEmail?: boolean;
}): Promise<CreateCheckoutSessionResult> {
  if (input.transaction.visitorId !== input.visitorId) {
    return { ok: false, code: 'transaction_not_found', error: 'Could not load payment session.' };
  }
  if (!isOpenPaymentTransactionHoldActive(input.transaction)) {
    return { ok: false, code: 'payment_hold_expired', error: 'The payment window has expired.' };
  }
  const shouldCommitCheckout =
    isPaymentCheckoutCommitted(input.metadata) &&
    !isPaymentCheckoutCommitted(input.transaction.metadata);
  const commitCheckoutIfNeeded = async (): Promise<void> => {
    if (shouldCommitCheckout) {
      await markPaymentCheckoutCommitted(input.transaction.id);
    }
  };
  const sendReminderIfRequested = async (): Promise<void> => {
    if (input.sendPaymentReminderEmail !== true) {
      return;
    }
    const transaction = await findPaymentTransactionById(input.transaction.id);
    if (transaction !== null) {
      await executeSendBookingPaymentReminderEmail({ transaction });
    }
  };
  const cachedRedirectUrl = input.transaction.redirectUrl?.trim() ?? '';
  const metadataPaymentMethodId = input.transaction.metadata?.paymentMethodId?.trim() ?? '';
  const canReuseCachedRedirect =
    cachedRedirectUrl.length > 0 &&
    input.transaction.gatewayId === input.gatewayId &&
    metadataPaymentMethodId === input.paymentMethodId &&
    input.transaction.amountCentavos === input.amountCentavos;
  if (canReuseCachedRedirect) {
    input.timing?.mark('gateway_create_reused');
    await timeCheckoutSegment(input.timing, 'checkout_commit', () => commitCheckoutIfNeeded());
    await timeCheckoutSegment(input.timing, 'payment_reminder', () => sendReminderIfRequested());
    return {
      ok: true,
      transactionId: input.transaction.id,
      redirectUrl: cachedRedirectUrl,
      bookingId: input.transaction.bookingId,
      manualConfirm: false,
      mock: false,
      bookingStatus: input.bookingStatus,
    };
  }
  const transactionObjectId = new ObjectId(input.transaction.id);
  await timeCheckoutSegment(input.timing, 'checkout_commit', () => commitCheckoutIfNeeded());
  await timeCheckoutSegment(input.timing, 'resume_tx_update', () =>
    updateOpenPaymentTransactionForCheckoutResume(transactionObjectId, {
    gatewayId: input.gatewayId,
    amountCentavos: input.amountCentavos,
    paymentMethodLabel: input.paymentMethodLabel,
    metadata: input.metadata,
    customerName: input.customerName,
    customerEmail: input.customerEmail,
    customerCompany: input.customerCompany,
      customerPhone: input.customerPhone,
    }),
  );
  const { successUrl, cancelUrl } = buildPaymentProviderReturnUrls({
    appBaseUrl: input.appBaseUrl,
    transactionId: input.transaction.id,
    nativeInAppPaymentReturn: input.nativeInAppPaymentReturn === true,
    cancelRelativeUrl: `${buildMarketingBookSessionPath(input.sessionMarketingRef)}?payment=cancelled`,
    sessionMarketingRef: input.sessionMarketingRef,
  });
  const providerResult = await runProviderCheckout({
    checkoutContext: input.checkoutContext,
    gatewayId: input.gatewayId,
    successUrl,
    sessionInput: {
      amountCentavos: input.amountCentavos,
      currency: 'PHP',
      description: input.description,
      lineItems: input.lineItems,
      cancelUrl,
      referenceId: input.transaction.bookingDraftId,
      metadata: {
        transactionId: input.transaction.id,
        visitorId: input.visitorId,
        bookingDraftId: input.transaction.bookingDraftId,
        paymentMethodId: input.paymentMethodId,
        ...(input.transaction.bookingId !== null ? { bookingId: input.transaction.bookingId } : {}),
      },
      paymentMethodId: input.paymentMethodId,
      customerName: input.customerName,
      customerEmail: input.customerEmail,
      customerPhone: input.customerPhone,
    },
    timing: input.timing,
  });
  if (!providerResult.ok) {
    return providerResult;
  }
  await timeCheckoutSegment(input.timing, 'provider_persist', () =>
    updatePaymentTransactionProvider(transactionObjectId, providerResult.session),
  );
  await timeCheckoutSegment(input.timing, 'payment_reminder', () => sendReminderIfRequested());
  return {
    ok: true,
    transactionId: input.transaction.id,
    redirectUrl: providerResult.session.redirectUrl,
    bookingId: input.transaction.bookingId,
    manualConfirm: false,
    mock: providerResult.session.useMock,
    bookingStatus: input.bookingStatus,
  };
}
