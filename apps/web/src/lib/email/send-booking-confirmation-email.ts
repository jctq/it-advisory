import { COLLECTIONS } from '@/domain/collections';
import type { EmailSendDocument } from '@/domain/types';
import type { PaymentGatewayId } from '@/domain/payment-types';
import { findBookingById } from '@/lib/data/bookings';
import { findLeadById } from '@/lib/data/leads';
import { findPaymentTransactionById, type PaymentTransactionRow } from '@/lib/data/payment-transactions';
import { getDb } from '@/lib/mongodb';
import { formatBookingReferenceId } from '@/lib/marketing/booking-reference';
import { formatInTimeZone } from 'date-fns-tz';
import { executeDispatchTransactionalEmail } from '@/lib/email/send-transactional-email';

const BOOKING_PAYMENT_CONFIRMED_TEMPLATE_KEY = 'booking_payment_confirmed';

const EMAIL_ADDRESS_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const GATEWAY_LABELS: Readonly<Record<PaymentGatewayId, string>> = {
  xendit: 'Xendit',
  paymongo: 'PayMongo',
  hitpay: 'HitPay',
  paypal: 'PayPal',
};

function resolveGatewayLabel(gatewayId: PaymentGatewayId): string {
  return GATEWAY_LABELS[gatewayId] ?? gatewayId;
}

function formatServiceKeyLabel(serviceKey: string): string {
  const parts = serviceKey.split(/[-_]/).filter((part) => part.length > 0);
  if (parts.length === 0) {
    return 'Consultation';
  }
  return parts
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}`)
    .join(' ');
}

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function resolveMarketingSiteBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (raw === undefined || raw.length === 0) {
    return '';
  }
  return raw.replace(/\/$/, '');
}

function formatAmountPhp(centavos: number): string {
  const pesos = centavos / 100;
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(pesos);
}

function resolveRecipientEmail(
  lead: { readonly email: string } | null,
  transaction: PaymentTransactionRow | null,
): string | null {
  const fromLead = lead?.email?.trim() ?? '';
  if (fromLead.length > 0 && fromLead !== '—' && EMAIL_ADDRESS_PATTERN.test(fromLead)) {
    return fromLead;
  }
  const fromTx = transaction?.customerEmail?.trim() ?? '';
  if (fromTx.length > 0 && EMAIL_ADDRESS_PATTERN.test(fromTx)) {
    return fromTx;
  }
  return null;
}

function buildConfirmationHtml(input: {
  readonly customerName: string;
  readonly bookingReference: string;
  readonly serviceLabel: string;
  readonly dateLong: string;
  readonly timeLabel: string;
  readonly manageUrl: string;
  readonly meetingUrl: string | null;
  readonly paymentSectionHtml: string | null;
}): string {
  const meetingBlock =
    input.meetingUrl !== null && input.meetingUrl.trim().length > 0
      ? `<p><strong>Meeting link:</strong> <a href="${escapeHtml(input.meetingUrl)}">${escapeHtml(input.meetingUrl)}</a></p>`
      : '<p>Your meeting link will follow in a separate message if your advisor attaches one to this booking.</p>';
  const paymentBlock =
    input.paymentSectionHtml !== null && input.paymentSectionHtml.length > 0
      ? `<h2 style="margin:24px 0 8px;font-size:16px;">Payment</h2>${input.paymentSectionHtml}`
      : '';
  return `<!DOCTYPE html>
<html><body style="font-family:system-ui,sans-serif;line-height:1.5;color:#111;">
<p>Hi ${escapeHtml(input.customerName)},</p>
<p>Your booking is <strong>confirmed</strong>. Thank you — we have received your payment and reserved your slot.</p>
<h2 style="margin:24px 0 8px;font-size:16px;">Reservation</h2>
<p><strong>Service:</strong> ${escapeHtml(input.serviceLabel)}</p>
<p><strong>When:</strong> ${escapeHtml(input.dateLong)} · ${escapeHtml(input.timeLabel)}</p>
<p><strong>Booking reference:</strong> ${escapeHtml(input.bookingReference)}</p>
${meetingBlock}
<p><a href="${escapeHtml(input.manageUrl)}">View or manage this booking</a> (reference, email, and phone last four).</p>
${paymentBlock}
<p style="margin-top:28px;font-size:13px;color:#555;">This message was sent automatically. If you did not make this booking, please contact support.</p>
</body></html>`;
}

function buildPaymentSectionHtml(transaction: PaymentTransactionRow): string {
  const lines: string[] = [];
  lines.push(`<p><strong>Amount:</strong> ${escapeHtml(formatAmountPhp(transaction.amountCentavos))}</p>`);
  lines.push(`<p><strong>Gateway:</strong> ${escapeHtml(resolveGatewayLabel(transaction.gatewayId))}</p>`);
  const method = transaction.paymentMethodLabel?.trim() ?? '';
  if (method.length > 0) {
    lines.push(`<p><strong>Method:</strong> ${escapeHtml(method)}</p>`);
  }
  const ref = transaction.providerRef.trim();
  if (ref.length > 0) {
    lines.push(`<p><strong>Reference:</strong> ${escapeHtml(ref.length > 64 ? `${ref.slice(0, 64)}…` : ref)}</p>`);
  }
  return lines.join('');
}

async function persistEmailSend(doc: Omit<EmailSendDocument, '_id'>): Promise<void> {
  const db = await getDb();
  await db.collection<EmailSendDocument>(COLLECTIONS.emailSends).insertOne(doc);
}

/**
 * Sends the booking + payment confirmation using admin Email settings (or Resend env fallback) and records `email_sends`.
 * Swallows expected failures so payment and admin flows are never blocked.
 */
export async function executeSendBookingConfirmationEmail(input: {
  readonly bookingId: string;
  readonly transaction: PaymentTransactionRow | null;
}): Promise<void> {
  if (!process.env.MONGODB_URI) {
    return;
  }
  try {
    await runSendBookingConfirmationEmail(input);
  } catch (err) {
    console.error('[booking-email] executeSendBookingConfirmationEmail', err);
  }
}

async function runSendBookingConfirmationEmail(input: {
  readonly bookingId: string;
  readonly transaction: PaymentTransactionRow | null;
}): Promise<void> {
  const booking = await findBookingById(input.bookingId);
  if (booking === null || booking.status !== 'confirmed') {
    return;
  }
  const transaction =
    input.transaction ??
    (booking.paymentTransactionId !== null
      ? await findPaymentTransactionById(booking.paymentTransactionId)
      : null);
  const lead = await findLeadById(booking.leadId);
  const to = resolveRecipientEmail(lead, transaction);
  if (to === null) {
    return;
  }
  let customerName = 'there';
  if (lead !== null && lead.name.trim().length > 0) {
    customerName = lead.name.trim();
  } else if (
    transaction !== null &&
    transaction.customerName !== null &&
    transaction.customerName.trim().length > 0
  ) {
    customerName = transaction.customerName.trim();
  }
  const startsAt = new Date(booking.startsAtIso);
  const dateLong = formatInTimeZone(startsAt, booking.timezone, 'EEEE, MMMM d, yyyy');
  const timeLabel = formatInTimeZone(startsAt, booking.timezone, 'h:mm a');
  const bookingReference = formatBookingReferenceId(booking.id);
  const baseUrl = resolveMarketingSiteBaseUrl();
  const manageUrl =
    baseUrl.length > 0 ? `${baseUrl}/book/manage` : '/book/manage';
  const meetingUrl =
    booking.meetingUrl !== undefined && typeof booking.meetingUrl === 'string' && booking.meetingUrl.trim().length > 0
      ? booking.meetingUrl.trim()
      : null;
  const paymentSectionHtml = transaction !== null ? buildPaymentSectionHtml(transaction) : null;
  const html = buildConfirmationHtml({
    customerName,
    bookingReference,
    serviceLabel: formatServiceKeyLabel(booking.serviceKey),
    dateLong,
    timeLabel,
    manageUrl,
    meetingUrl,
    paymentSectionHtml,
  });
  const subject = `Booking confirmed — ${bookingReference}`;
  const basePayload: Record<string, unknown> = {
    bookingId: booking.id,
    transactionId: transaction?.id ?? null,
    bookingReference,
  };
  const outcome = await executeDispatchTransactionalEmail({ to, subject, html });
  if (outcome.kind === 'audit_only') {
    await persistEmailSend({
      to,
      templateKey: BOOKING_PAYMENT_CONFIRMED_TEMPLATE_KEY,
      payload: { ...basePayload, channel: 'audit_only' },
      status: 'mock_sent',
      createdAt: new Date(),
    });
    return;
  }
  const persistPayload: Record<string, unknown> = {
    ...basePayload,
    ...(outcome.sandboxIntendedTo !== undefined
      ? { sandboxIntendedTo: outcome.sandboxIntendedTo, sandboxMode: true }
      : {}),
  };
  if (outcome.kind === 'failed') {
    await persistEmailSend({
      to: outcome.persistTo,
      templateKey: BOOKING_PAYMENT_CONFIRMED_TEMPLATE_KEY,
      payload: {
        ...persistPayload,
        errorMessage: outcome.errorMessage,
        errorName: outcome.errorName,
        statusCode: outcome.statusCode,
      },
      status: 'failed',
      createdAt: new Date(),
    });
    return;
  }
  await persistEmailSend({
    to: outcome.persistTo,
    templateKey: BOOKING_PAYMENT_CONFIRMED_TEMPLATE_KEY,
    payload: { ...persistPayload, provider: outcome.provider },
    status: 'sent',
    providerMessageId: outcome.providerMessageId,
    createdAt: new Date(),
  });
}

