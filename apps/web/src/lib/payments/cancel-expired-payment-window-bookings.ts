import { ObjectId } from 'mongodb';
import type { Filter } from 'mongodb';
import { COLLECTIONS } from '@/domain/collections';
import type { BookingDocument } from '@/domain/types';
import { getPaymentSettings } from '@/lib/data/payment-settings';
import { findPaymentTransactionById, type PaymentTransactionRow } from '@/lib/data/payment-transactions';
import { isAwaitingPaymentHoldExpired } from '@/lib/marketing/payment-hold-expiry';
import {
  applyPaymentStatusToBooking,
  resetBookingAfterExpiredPaymentHold,
} from '@/lib/payments/payment-completion';
import { getDb } from '@/lib/mongodb';

const OPEN_CHECKOUT_PAYMENT_STATUSES: Filter<BookingDocument> = {
  $or: [
    { paymentStatus: { $exists: false } },
    { paymentStatus: null },
    { paymentStatus: { $in: ['pending', 'processing'] } },
  ],
};

/** Pending bookings with an open checkout that may have an expired hold window. */
const STALE_AWAITING_PAYMENT_BOOKING_FILTER = (): Filter<BookingDocument> => ({
  status: 'pending',
  paymentTransactionId: { $ne: null },
  ...OPEN_CHECKOUT_PAYMENT_STATUSES,
});

function isOpenCheckoutPaymentStatus(status: BookingDocument['paymentStatus']): boolean {
  return status === undefined || status === null || status === 'pending' || status === 'processing';
}

function resolveAwaitingPaymentHoldExpired(input: {
  readonly booking: BookingDocument;
  readonly transaction: PaymentTransactionRow | null;
  readonly holdExpiresMinutes: number;
  readonly now: Date;
}): boolean {
  return isAwaitingPaymentHoldExpired({
    bookingPaymentExpiresAt: input.booking.paymentExpiresAt,
    transactionExpiresAtIso: input.transaction?.expiresAtIso ?? null,
    transactionCreatedAtIso: input.transaction?.createdAtIso ?? null,
    holdExpiresMinutes: input.holdExpiresMinutes,
    nowMs: input.now.getTime(),
  });
}

async function syncPendingBookingForExpiredPaymentWindow(
  booking: BookingDocument & { readonly _id: ObjectId },
  input: { readonly transaction: PaymentTransactionRow | null; readonly now: Date },
): Promise<boolean> {
  const paymentTransactionId = booking.paymentTransactionId;
  if (paymentTransactionId !== undefined && paymentTransactionId !== null) {
    const transaction =
      input.transaction ?? (await findPaymentTransactionById(paymentTransactionId.toString()));
    if (
      transaction !== null &&
      (transaction.status === 'pending' || transaction.status === 'processing')
    ) {
      await applyPaymentStatusToBooking({
        transaction,
        nextStatus: 'expired',
        expiredBookingDisposition: 'retain_pending',
      });
      return true;
    }
    if (
      transaction !== null &&
      transaction.status === 'expired' &&
      isOpenCheckoutPaymentStatus(booking.paymentStatus)
    ) {
      await resetBookingAfterExpiredPaymentHold(booking._id);
      return true;
    }
  }
  await resetBookingAfterExpiredPaymentHold(booking._id);
  return true;
}

export type CancelExpiredPaymentWindowBookingsInput = {
  readonly now?: Date;
  readonly visitorId?: string;
  readonly bookingId?: string;
};

/**
 * Expires unpaid checkout holds whose window has passed and keeps bookings in pending status for rebook flows.
 */
export async function cancelExpiredPaymentWindowBookings(
  input: CancelExpiredPaymentWindowBookingsInput = {},
): Promise<number> {
  if (!process.env.MONGODB_URI) {
    return 0;
  }
  const now = input.now ?? new Date();
  const { holdExpiresMinutes } = await getPaymentSettings();
  const filter: Filter<BookingDocument> = {
    ...STALE_AWAITING_PAYMENT_BOOKING_FILTER(),
  };
  if (input.visitorId !== undefined && input.visitorId.trim().length > 0) {
    filter.visitorId = input.visitorId.trim();
  }
  if (input.bookingId !== undefined && input.bookingId.trim().length > 0) {
    try {
      filter._id = new ObjectId(input.bookingId.trim());
    } catch {
      return 0;
    }
  }
  const db = await getDb();
  const docs = await db
    .collection<BookingDocument>(COLLECTIONS.bookings)
    .find(filter)
    .limit(200)
    .toArray();
  let count = 0;
  for (const doc of docs) {
    if (doc._id === undefined) {
      continue;
    }
    const paymentTransactionId = doc.paymentTransactionId;
    let transaction: PaymentTransactionRow | null = null;
    if (paymentTransactionId !== undefined && paymentTransactionId !== null) {
      transaction = await findPaymentTransactionById(paymentTransactionId.toString());
    }
    if (
      !resolveAwaitingPaymentHoldExpired({
        booking: doc,
        transaction,
        holdExpiresMinutes,
        now,
      })
    ) {
      continue;
    }
    const synced = await syncPendingBookingForExpiredPaymentWindow(
      doc as BookingDocument & { _id: ObjectId },
      { transaction, now },
    );
    if (synced) {
      count += 1;
    }
  }
  return count;
}

/**
 * When a single booking is loaded for manage/checkout, sync status if the payment window already expired.
 */
export async function syncBookingIfPaymentWindowExpired(bookingId: string): Promise<void> {
  await cancelExpiredPaymentWindowBookings({ bookingId });
}

export type SyncSingleBookingPaymentWindowResult = {
  readonly didMutate: boolean;
};

/**
 * Fast path for checkout/prepare: loads one booking by id and syncs only when its hold has expired.
 */
export async function syncSingleBookingIfPaymentWindowExpired(
  bookingId: string,
  options?: { readonly holdExpiresMinutes?: number },
): Promise<SyncSingleBookingPaymentWindowResult> {
  if (!process.env.MONGODB_URI) {
    return { didMutate: false };
  }
  let bookingObjectId: ObjectId;
  try {
    bookingObjectId = new ObjectId(bookingId.trim());
  } catch {
    return { didMutate: false };
  }
  const db = await getDb();
  const booking = await db.collection<BookingDocument>(COLLECTIONS.bookings).findOne({ _id: bookingObjectId });
  if (booking === null || booking._id === undefined) {
    return { didMutate: false };
  }
  if (booking.status !== 'pending' || booking.paymentTransactionId === undefined || booking.paymentTransactionId === null) {
    return { didMutate: false };
  }
  if (!isOpenCheckoutPaymentStatus(booking.paymentStatus)) {
    return { didMutate: false };
  }
  const now = new Date();
  const holdExpiresMinutes = options?.holdExpiresMinutes ?? (await getPaymentSettings()).holdExpiresMinutes;
  const transaction = await findPaymentTransactionById(booking.paymentTransactionId.toString());
  if (
    !resolveAwaitingPaymentHoldExpired({
      booking,
      transaction,
      holdExpiresMinutes,
      now,
    })
  ) {
    return { didMutate: false };
  }
  await syncPendingBookingForExpiredPaymentWindow(booking as BookingDocument & { readonly _id: ObjectId }, {
    transaction,
    now,
  });
  return { didMutate: true };
}
