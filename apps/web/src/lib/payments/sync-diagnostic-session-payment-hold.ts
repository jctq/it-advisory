import { ObjectId } from 'mongodb';
import { findBookingById, findPrimaryBookingSlotByDiagnosticSessionId } from '@/lib/data/bookings';
import { getPaymentSettings } from '@/lib/data/payment-settings';
import { findLatestPaymentTransactionByDiagnosticSessionIdHex } from '@/lib/data/payment-transactions';
import { isReleasedBookingSlotStartsAt } from '@/lib/booking/pending-payment-expired-for-rebook';
import {
  isAwaitingPaymentHoldExpired,
  parsePaymentHoldExpiresAtMs,
} from '@/lib/marketing/payment-hold-expiry';
import {
  applyPaymentStatusToBooking,
  renewBookingCheckoutHoldFromOpenTransaction,
  resetBookingAfterExpiredPaymentHold,
} from '@/lib/payments/payment-completion';
import { cancelExpiredPaymentWindowBookings } from '@/lib/payments/cancel-expired-payment-window-bookings';

async function releaseOccupiedSlotWhenHoldExpired(input: {
  readonly bookingId: string;
  readonly diagnosticSessionIdHex: string;
  readonly now: Date;
}): Promise<boolean> {
  const booking = await findBookingById(input.bookingId);
  if (booking === null || booking.status !== 'pending') {
    return false;
  }
  const startsAt = new Date(booking.startsAtIso);
  if (!Number.isFinite(startsAt.getTime()) || isReleasedBookingSlotStartsAt(startsAt)) {
    return false;
  }
  const { holdExpiresMinutes } = await getPaymentSettings();
  const latestPayment = await findLatestPaymentTransactionByDiagnosticSessionIdHex(input.diagnosticSessionIdHex);
  const paymentExpiresAtIso = booking.paymentExpiresAtIso?.trim() ?? '';
  const bookingPaymentExpiresAt =
    paymentExpiresAtIso.length > 0 && Number.isFinite(Date.parse(paymentExpiresAtIso))
      ? new Date(paymentExpiresAtIso)
      : null;
  if (
    !isAwaitingPaymentHoldExpired({
      bookingPaymentExpiresAt,
      transactionExpiresAtIso: latestPayment?.expiresAtIso ?? null,
      transactionCreatedAtIso: latestPayment?.createdAtIso ?? null,
      holdExpiresMinutes,
      nowMs: input.now.getTime(),
    })
  ) {
    return false;
  }
  if (
    latestPayment !== null &&
    (latestPayment.status === 'pending' || latestPayment.status === 'processing')
  ) {
    await applyPaymentStatusToBooking({
      transaction: latestPayment,
      nextStatus: 'expired',
      expiredBookingDisposition: 'retain_pending',
    });
    return true;
  }
  await resetBookingAfterExpiredPaymentHold(new ObjectId(input.bookingId));
  return true;
}

async function expireLatestOpenPaymentTransactionForSession(
  diagnosticSessionIdHex: string,
  now: Date,
): Promise<boolean> {
  const transaction = await findLatestPaymentTransactionByDiagnosticSessionIdHex(diagnosticSessionIdHex);
  if (transaction === null) {
    return false;
  }
  if (transaction.status !== 'pending' && transaction.status !== 'processing') {
    return false;
  }
  const expiresAtIso = transaction.expiresAtIso?.trim() ?? '';
  if (expiresAtIso.length === 0) {
    return false;
  }
  const expiresAtMs = Date.parse(expiresAtIso);
  if (!Number.isFinite(expiresAtMs) || expiresAtMs > now.getTime()) {
    return false;
  }
  await applyPaymentStatusToBooking({
    transaction,
    nextStatus: 'expired',
    expiredBookingDisposition: 'retain_pending',
  });
  return true;
}

function resolveExpiresAtForOpenTransaction(
  expiresAtIso: string | null | undefined,
  now: Date,
  holdExpiresMinutes: number,
  createdAtIso: string | null | undefined,
): Date {
  const fromIso = parsePaymentHoldExpiresAtMs(expiresAtIso);
  if (fromIso !== null && fromIso > now.getTime()) {
    return new Date(fromIso);
  }
  const createdAtMs = parsePaymentHoldExpiresAtMs(createdAtIso);
  if (createdAtMs !== null && holdExpiresMinutes > 0) {
    return new Date(createdAtMs + holdExpiresMinutes * 60_000);
  }
  return new Date(now.getTime() + holdExpiresMinutes * 60_000);
}

async function renewStaleBookingForOpenTransaction(input: {
  readonly bookingId: string;
  readonly diagnosticSessionIdHex: string;
  readonly now: Date;
}): Promise<boolean> {
  const transaction = await findLatestPaymentTransactionByDiagnosticSessionIdHex(input.diagnosticSessionIdHex);
  if (
    transaction === null ||
    (transaction.status !== 'pending' && transaction.status !== 'processing')
  ) {
    return false;
  }
  const booking = await findBookingById(input.bookingId);
  if (booking === null) {
    return false;
  }
  const { holdExpiresMinutes } = await getPaymentSettings();
  const paymentExpiresAtIso = booking.paymentExpiresAtIso?.trim() ?? '';
  const bookingPaymentExpiresAt =
    paymentExpiresAtIso.length > 0 && Number.isFinite(Date.parse(paymentExpiresAtIso))
      ? new Date(paymentExpiresAtIso)
      : null;
  if (
    isAwaitingPaymentHoldExpired({
      bookingPaymentExpiresAt,
      transactionExpiresAtIso: transaction.expiresAtIso,
      transactionCreatedAtIso: transaction.createdAtIso,
      holdExpiresMinutes,
      nowMs: input.now.getTime(),
    })
  ) {
    return false;
  }
  const needsRenewal =
    booking.paymentStatus === 'expired' ||
    booking.paymentStatus === 'failed' ||
    booking.paymentTransactionId?.toString() !== transaction.id;
  if (!needsRenewal) {
    return false;
  }
  const expiresAt = resolveExpiresAtForOpenTransaction(
    transaction.expiresAtIso,
    input.now,
    holdExpiresMinutes,
    transaction.createdAtIso,
  );
  await renewBookingCheckoutHoldFromOpenTransaction({
    bookingId: new ObjectId(booking.id),
    transaction,
    expiresAt,
  });
  return true;
}

export type SyncDiagnosticSessionPaymentHoldResult = {
  readonly expired: boolean;
  readonly bookingId: string | null;
};

/**
 * Expires unpaid holds for a diagnostic session (booking row and/or open checkout transaction) using server time.
 */
export async function syncDiagnosticSessionPaymentHold(input: {
  readonly diagnosticSessionIdHex: string;
  readonly visitorId: string;
  readonly now?: Date;
}): Promise<SyncDiagnosticSessionPaymentHoldResult> {
  const now = input.now ?? new Date();
  let bookingId: string | null = null;
  let expired = false;
  const primarySlot = await findPrimaryBookingSlotByDiagnosticSessionId(new ObjectId(input.diagnosticSessionIdHex));
  if (primarySlot !== null) {
    bookingId = primarySlot.bookingId;
    const syncedCount = await cancelExpiredPaymentWindowBookings({
      now,
      visitorId: input.visitorId,
      bookingId: primarySlot.bookingId,
    });
    if (syncedCount > 0) {
      expired = true;
    } else {
      const released = await releaseOccupiedSlotWhenHoldExpired({
        bookingId: primarySlot.bookingId,
        diagnosticSessionIdHex: input.diagnosticSessionIdHex,
        now,
      });
      if (released) {
        expired = true;
      } else {
        const renewed = await renewStaleBookingForOpenTransaction({
          bookingId: primarySlot.bookingId,
          diagnosticSessionIdHex: input.diagnosticSessionIdHex,
          now,
        });
        if (renewed) {
          expired = false;
        } else {
          const booking = await findBookingById(primarySlot.bookingId);
          const latestPayment = await findLatestPaymentTransactionByDiagnosticSessionIdHex(input.diagnosticSessionIdHex);
          const hasOpenPayment =
            latestPayment !== null &&
            (latestPayment.status === 'pending' || latestPayment.status === 'processing');
          if (booking !== null && booking.paymentStatus === 'expired' && !hasOpenPayment) {
            expired = true;
          }
        }
      }
    }
  }
  if (!expired) {
    const transactionExpired = await expireLatestOpenPaymentTransactionForSession(input.diagnosticSessionIdHex, now);
    if (transactionExpired) {
      expired = true;
    }
  }
  return { expired, bookingId };
}
