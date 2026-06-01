import { COLLECTIONS } from '@/domain/collections';
import type { EmailSendDocument } from '@/domain/types';
import { findBookingById } from '@/lib/data/bookings';
import { findBookingRefundByBookingId } from '@/lib/data/booking-refunds';
import { getResolvedSiteName } from '@/lib/data/app-settings';
import { findLeadById } from '@/lib/data/leads';
import { findPaymentTransactionById, type PaymentTransactionRow } from '@/lib/data/payment-transactions';
import { formatBookingReferenceId } from '@/lib/marketing/booking-reference';
import {
  buildTransactionalEmailBrandNameRow,
  resolveAbsoluteSiteOrigin,
} from '@/lib/email/email-brand';
import { executeDispatchTransactionalEmail } from '@/lib/email/send-transactional-email';
import { readManageBookingEnabled } from '@/lib/marketing/manage-booking-gate';
import { getDb } from '@/lib/mongodb';
import { formatInTimeZone } from 'date-fns-tz';

async function persistEmailSend(doc: Omit<EmailSendDocument, '_id'>): Promise<void> {
  const db = await getDb();
  await db.collection<EmailSendDocument>(COLLECTIONS.emailSends).insertOne(doc);
}

const BOOKING_CANCELLATION_REFUND_PENDING_TEMPLATE_KEY = 'booking_cancellation_refund_pending';
const EMAIL_ADDRESS_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_INNER_WIDTH_PX = 600;
const EMAIL_FONT_STACK =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif";

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildEmailDetailRow(label: string, value: string): string {
  return `<tr><td style="padding:6px 0;font-family:${EMAIL_FONT_STACK};font-size:14px;line-height:22px;color:#52525b;width:148px;vertical-align:top;"><strong style="color:#18181b;">${escapeHtml(label)}</strong></td><td style="padding:6px 0;font-family:${EMAIL_FONT_STACK};font-size:14px;line-height:22px;color:#18181b;vertical-align:top;">${escapeHtml(value)}</td></tr>`;
}

function formatAmountPhp(centavos: number): string {
  return `₱${(centavos / 100).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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

export function buildBookingCancellationRefundPendingSubject(bookingReference: string): string {
  return `Booking cancelled — refund pending (${bookingReference})`;
}

export function buildBookingCancellationRefundPendingEmailHtml(input: {
  readonly brandName: string;
  readonly customerName: string;
  readonly bookingReference: string;
  readonly dateLong: string;
  readonly timeLabel: string;
  readonly refundAmountLabel: string;
  readonly manageUrl: string;
}): string {
  const brandNameRow = buildTransactionalEmailBrandNameRow({
    brandName: input.brandName,
    fontStack: EMAIL_FONT_STACK,
  });
  const reservationRows = [
    buildEmailDetailRow('When', `${input.dateLong} · ${input.timeLabel}`),
    buildEmailDetailRow('Booking reference', input.bookingReference),
    buildEmailDetailRow('Refund amount', input.refundAmountLabel),
  ].join('');
  const manageSection =
    input.manageUrl.length > 0
      ? `<p style="margin:0 0 12px 0;font-family:${EMAIL_FONT_STACK};font-size:14px;line-height:22px;color:#52525b;">You can check your booking status anytime on <strong style="color:#18181b;">Manage booking</strong>.</p><p style="margin:0;font-family:${EMAIL_FONT_STACK};font-size:14px;line-height:22px;color:#52525b;"><a href="${escapeHtml(input.manageUrl)}" style="color:#0f172a;font-weight:600;">Manage booking</a></p>`
      : '';
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${escapeHtml(`Booking cancelled — ${input.bookingReference}`)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f4f5;">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="${EMAIL_INNER_WIDTH_PX}" cellpadding="0" cellspacing="0" border="0" style="max-width:${EMAIL_INNER_WIDTH_PX}px;width:100%;background-color:#ffffff;border-radius:12px;border:1px solid #e4e4e7;">
<tr><td style="padding:32px 28px;">
${brandNameRow}
<h1 style="margin:0 0 12px 0;font-family:${EMAIL_FONT_STACK};font-size:22px;line-height:30px;font-weight:700;color:#18181b;">Your booking has been cancelled</h1>
<p style="margin:0 0 20px 0;font-family:${EMAIL_FONT_STACK};font-size:15px;line-height:24px;color:#3f3f46;">Hi ${escapeHtml(input.customerName)},</p>
<p style="margin:0 0 20px 0;font-family:${EMAIL_FONT_STACK};font-size:15px;line-height:24px;color:#3f3f46;">We received your cancellation request. Your scheduled video meeting has been removed. Your refund is <strong style="color:#18181b;">pending manual processing</strong> — our team will process it and notify you once complete.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px 0;border-collapse:separate;"><tr><td style="padding:18px 20px;border:1px solid #e4e4e7;border-radius:10px;background-color:#fafafa;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${reservationRows}</table></td></tr></table>
${manageSection}
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

function buildPlainText(input: {
  readonly brandName: string;
  readonly customerName: string;
  readonly bookingReference: string;
  readonly dateLong: string;
  readonly timeLabel: string;
  readonly refundAmountLabel: string;
  readonly manageUrl: string;
}): string {
  const lines = [
    `Hi ${input.customerName},`,
    '',
    'Your booking has been cancelled. Your scheduled video meeting has been removed.',
    'Your refund is pending manual processing — our team will process it and notify you once complete.',
    '',
    `When: ${input.dateLong} · ${input.timeLabel}`,
    `Booking reference: ${input.bookingReference}`,
    `Refund amount: ${input.refundAmountLabel}`,
  ];
  if (input.manageUrl.length > 0) {
    lines.push('', `Manage booking: ${input.manageUrl}`);
  }
  lines.push('', input.brandName);
  return lines.join('\n');
}

export async function executeSendBookingCancellationRefundPendingEmail(input: {
  readonly bookingId: string;
  readonly refundId: string;
}): Promise<void> {
  if (!process.env.MONGODB_URI) {
    return;
  }
  try {
    await runSendBookingCancellationRefundPendingEmail(input);
  } catch (err) {
    console.error('[booking-email] executeSendBookingCancellationRefundPendingEmail', err);
  }
}

async function hasCancellationEmailBeenSent(bookingId: string): Promise<boolean> {
  const db = await getDb();
  const existing = await db.collection<EmailSendDocument>(COLLECTIONS.emailSends).findOne({
    templateKey: BOOKING_CANCELLATION_REFUND_PENDING_TEMPLATE_KEY,
    'payload.bookingId': bookingId,
    status: { $in: ['sent', 'mock_sent'] },
  });
  return existing !== null;
}

async function runSendBookingCancellationRefundPendingEmail(input: {
  readonly bookingId: string;
  readonly refundId: string;
}): Promise<void> {
  if (await hasCancellationEmailBeenSent(input.bookingId)) {
    return;
  }
  const booking = await findBookingById(input.bookingId);
  if (booking === null || booking.status !== 'refund_awaiting') {
    return;
  }
  const refund = await findBookingRefundByBookingId(input.bookingId);
  if (refund === null) {
    return;
  }
  const transaction =
    booking.paymentTransactionId !== null
      ? await findPaymentTransactionById(booking.paymentTransactionId)
      : null;
  const lead = await findLeadById(booking.leadId);
  const to = resolveRecipientEmail(lead, transaction);
  if (to === null) {
    return;
  }
  const brandName = await getResolvedSiteName();
  const bookingReference = formatBookingReferenceId(booking.id);
  const timezone = booking.timezone.trim().length > 0 ? booking.timezone : 'UTC';
  const startsAt = new Date(booking.startsAtIso);
  const dateLong = formatInTimeZone(startsAt, timezone, 'EEEE, MMMM d, yyyy');
  const timeLabel = formatInTimeZone(startsAt, timezone, 'h:mm a');
  const manageBookingEnabled = await readManageBookingEnabled();
  const siteOrigin = resolveAbsoluteSiteOrigin();
  const manageUrl =
    manageBookingEnabled && siteOrigin.length > 0
      ? `${siteOrigin}/book/manage?bookingReference=${encodeURIComponent(bookingReference)}`
      : '';
  const customerName = lead?.name?.trim() ?? transaction?.customerName?.trim() ?? 'there';
  const refundAmountLabel = formatAmountPhp(refund.requestedAmountCentavos);
  const html = buildBookingCancellationRefundPendingEmailHtml({
    brandName,
    customerName,
    bookingReference,
    dateLong,
    timeLabel,
    refundAmountLabel,
    manageUrl,
  });
  const text = buildPlainText({
    brandName,
    customerName,
    bookingReference,
    dateLong,
    timeLabel,
    refundAmountLabel,
    manageUrl,
  });
  const subject = buildBookingCancellationRefundPendingSubject(bookingReference);
  const basePayload: Record<string, unknown> = {
    bookingId: input.bookingId,
    refundId: input.refundId,
    bookingReference,
  };
  const outcome = await executeDispatchTransactionalEmail({ to, subject, html, text });
  if (outcome.kind === 'audit_only') {
    await persistEmailSend({
      to,
      templateKey: BOOKING_CANCELLATION_REFUND_PENDING_TEMPLATE_KEY,
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
      templateKey: BOOKING_CANCELLATION_REFUND_PENDING_TEMPLATE_KEY,
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
    templateKey: BOOKING_CANCELLATION_REFUND_PENDING_TEMPLATE_KEY,
    payload: { ...persistPayload, provider: outcome.provider },
    status: 'sent',
    providerMessageId: outcome.providerMessageId,
    createdAt: new Date(),
  });
}

export function buildBookingCancellationRefundPendingPreview(): {
  readonly subject: string;
  readonly html: string;
} {
  const html = buildBookingCancellationRefundPendingEmailHtml({
    brandName: 'TeqMD',
    customerName: 'Alex Rivera',
    bookingReference: 'A1B2C3D4',
    dateLong: 'Monday, June 15, 2026',
    timeLabel: '10:00 AM',
    refundAmountLabel: '₱2,500.00',
    manageUrl: 'https://example.com/book/manage',
  });
  return {
    subject: buildBookingCancellationRefundPendingSubject('A1B2C3D4'),
    html,
  };
}
