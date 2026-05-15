import type { PaymentStatus } from '@/domain/payment-types';
import { getGatewayCredentials, getPaymentSettings } from '@/lib/data/payment-settings';
import { findPaymentTransactionById, type PaymentTransactionRow } from '@/lib/data/payment-transactions';
import { applyPaymentStatusToBooking } from '@/lib/payments/payment-completion';
import { resolvePaymentAdapter } from '@techmd/payments';

const RECONCILABLE_STATUSES: readonly PaymentStatus[] = ['pending', 'processing'];

export async function reconcilePaymentTransactionIfPending(
  transaction: PaymentTransactionRow,
): Promise<PaymentTransactionRow> {
  if (!RECONCILABLE_STATUSES.includes(transaction.status)) {
    return transaction;
  }
  if (transaction.providerSessionId.trim().length === 0) {
    return transaction;
  }
  const credentials = await getGatewayCredentials(transaction.gatewayId);
  if (credentials === null) {
    return transaction;
  }
  const settings = await getPaymentSettings();
  const adapter = resolvePaymentAdapter(transaction.gatewayId, credentials);
  let providerEvent;
  try {
    providerEvent = await adapter.reconcileCheckoutSession({
      providerSessionId: transaction.providerSessionId,
      providerRef: transaction.providerRef,
      sandboxMode: settings.sandboxMode,
    });
  } catch {
    return transaction;
  }
  if (providerEvent === null) {
    return transaction;
  }
  await applyPaymentStatusToBooking({
    transaction,
    nextStatus: providerEvent.status,
  });
  const refreshed = await findPaymentTransactionById(transaction.id);
  return refreshed ?? transaction;
}
