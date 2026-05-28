import { COLLECTIONS } from '@/domain/collections';
import type { EmailSendDocument } from '@/domain/types';
import { findBookingById } from '@/lib/data/bookings';
import { getResolvedSiteName } from '@/lib/data/app-settings';
import { findLeadById } from '@/lib/data/leads';
import { findPaymentTransactionById, type PaymentTransactionRow } from '@/lib/data/payment-transactions';
import { formatBookingReferenceId } from '@/lib/marketing/booking-reference';
import { formatBookingSlotPartsFromStartsAt } from '@/lib/marketing/booking-slot-from-starts-at';
import {
  buildTransactionalEmailBrandNameRow,
  resolveAbsoluteSiteOrigin,
} from '@/lib/email/email-brand';
import { executeDispatchTransactionalEmail } from '@/lib/email/send-transactional-email';
import { readManageBookingEnabled } from '@/lib/marketing/manage-booking-gate';
import { buildMarketingBookSessionPath } from '@/lib/marketing/quiz-session-marketing-ref';
import { encodeQuizSessionRefForMarketingUrl } from '@/lib/server/quiz-session-marketing-ref-crypto';
import { getDb } from '@/lib/mongodb';
import { formatInTimeZone } from 'date-fns-tz';
import { PRIMARY_TIMEZONE } from '@/lib/timezone';

const BOOKING_PAYMENT_REMINDER_TEMPLATE_KEY = 'booking_payment_reminder';
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

function buildBulletproofButton(label: string, href: string): string {
  const safeHref = escapeHtml(href);
  const safeLabel = escapeHtml(label);
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px 0;border-collapse:separate;mso-table-lspace:0pt;mso-table-rspace:0pt;"><tr><td bgcolor="#0f172a" style="background-color:#0f172a;border-radius:8px;mso-padding-alt:0;"><a href="${safeHref}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:14px 28px;font-family:${EMAIL_FONT_STACK};font-size:15px;font-weight:600;line-height:20px;color:#ffffff;text-decoration:none;border-radius:8px;">${safeLabel}</a></td></tr></table>`;
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

function formatPaymentDeadlineLabel(expiresAt: Date, timezone: string): string {
  const dateLong = formatInTimeZone(expiresAt, timezone, 'EEEE, MMMM d, yyyy');
  const timeLabel = formatInTimeZone(expiresAt, timezone, 'h:mm a');
  return `${dateLong} at ${timeLabel} (${timezone})`;
}

export function buildBookingPaymentReminderEmailHtml(input: {
  readonly brandName: string;
  readonly customerName: string;
  readonly bookingReference: string;
  readonly dateLong: string;
  readonly timeLabel: string;
  readonly paymentDeadlineLabel: string;
  readonly contactName: string;
  readonly contactEmail: string;
  readonly contactPhone: string;
  readonly contactCompany: string | null;
  readonly continueCheckoutUrl: string;
  readonly manageUrl: string;
}): string {
  const contactRows = [
    buildEmailDetailRow('Name', input.contactName),
    buildEmailDetailRow('Email', input.contactEmail),
    buildEmailDetailRow('Phone', input.contactPhone),
  ];
  if (input.contactCompany !== null && input.contactCompany.trim().length > 0) {
    contactRows.push(buildEmailDetailRow('Company', input.contactCompany.trim()));
  }
  const manageSection =
    input.manageUrl.length > 0
      ? `<p style="margin:0 0 12px 0;font-family:${EMAIL_FONT_STACK};font-size:14px;line-height:22px;color:#52525b;">To check status or pay later, open <strong style="color:#18181b;">Manage booking</strong> with the reference and contact details below.</p>${buildBulletproofButton('Manage booking', input.manageUrl)}`
      : `<p style="margin:0 0 20px 0;font-family:${EMAIL_FONT_STACK};font-size:14px;line-height:22px;color:#52525b;">To check status or pay later, visit ${escapeHtml(input.brandName)} and use <strong style="color:#18181b;">Manage booking</strong> with your reference, email, and phone last four.</p>`;
  const continueButton =
    input.continueCheckoutUrl.length > 0
      ? buildBulletproofButton('Continue to payment', input.continueCheckoutUrl)
      : '';
  const brandNameRow = buildTransactionalEmailBrandNameRow({
    brandName: input.brandName,
    fontStack: EMAIL_FONT_STACK,
  });
  const preheader = `Complete payment for booking ${input.bookingReference} on or before ${input.paymentDeadlineLabel}.`;
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${escapeHtml(`Complete your payment — ${input.bookingReference}`)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;">
<div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:#f4f4f5;">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f4f5;">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="${EMAIL_INNER_WIDTH_PX}" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:${EMAIL_INNER_WIDTH_PX}px;">
<tr><td style="padding:0;background-color:#ffffff;border:1px solid #e4e4e7;border-radius:12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding:32px 28px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${brandNameRow}
<tr><td style="padding:0 0 8px 0;font-family:${EMAIL_FONT_STACK};font-size:20px;font-weight:600;line-height:28px;color:#18181b;">Complete your payment</td></tr>
<tr><td style="padding:0 0 20px 0;font-family:${EMAIL_FONT_STACK};font-size:15px;line-height:24px;color:#3f3f46;">Hi ${escapeHtml(input.customerName)}, your consultation slot is held, but we have not received payment yet. Please pay on or before <strong style="color:#18181b;">${escapeHtml(input.paymentDeadlineLabel)}</strong>.</td></tr>
<tr><td>${continueButton}</td></tr>
<tr><td style="padding:0 0 16px 0;font-family:${EMAIL_FONT_STACK};font-size:13px;line-height:20px;color:#71717a;">Booking reference: <strong style="color:#18181b;">${escapeHtml(input.bookingReference)}</strong></td></tr>
<tr><td style="padding:0 0 8px 0;font-family:${EMAIL_FONT_STACK};font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;">Your reservation</td></tr>
<tr><td style="padding:0 0 20px 0;font-family:${EMAIL_FONT_STACK};font-size:14px;line-height:22px;color:#3f3f46;">${escapeHtml(input.dateLong)} · ${escapeHtml(input.timeLabel)}</td></tr>
<tr><td style="padding:0 0 8px 0;font-family:${EMAIL_FONT_STACK};font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;">Contact on file</td></tr>
<tr><td style="padding:0 0 20px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tbody>${contactRows.join('')}</tbody></table></td></tr>
<tr><td>${manageSection}</td></tr>
<tr><td style="padding:24px 0 0 0;border-top:1px solid #e4e4e7;"><p style="margin:0;font-family:${EMAIL_FONT_STACK};font-size:12px;line-height:18px;color:#71717a;">Save this email. You will need your booking reference, email, and the last four digits of your phone number to look up this booking later.</p></td></tr>
</table>
</td></tr></table>
</td></tr></table>
</td></tr></table>
</body>
</html>`;
}

function buildPaymentReminderPlainText(input: {
  readonly brandName: string;
  readonly customerName: string;
  readonly bookingReference: string;
  readonly dateLong: string;
  readonly timeLabel: string;
  readonly paymentDeadlineLabel: string;
  readonly contactName: string;
  readonly contactEmail: string;
  readonly contactPhone: string;
  readonly contactCompany: string | null;
  readonly continueCheckoutUrl: string;
  readonly manageUrl: string;
}): string {
  const lines: string[] = [
    `Hi ${input.customerName},`,
    '',
    `Your consultation slot is held, but we have not received payment yet. Please pay on or before ${input.paymentDeadlineLabel}.`,
    '',
    `Booking reference: ${input.bookingReference}`,
    '',
    'YOUR RESERVATION',
    `${input.dateLong} · ${input.timeLabel}`,
    '',
    'CONTACT ON FILE',
    `Name: ${input.contactName}`,
    `Email: ${input.contactEmail}`,
    `Phone: ${input.contactPhone}`,
  ];
  if (input.contactCompany !== null && input.contactCompany.trim().length > 0) {
    lines.push(`Company: ${input.contactCompany.trim()}`);
  }
  lines.push('');
  if (input.continueCheckoutUrl.length > 0) {
    lines.push('CONTINUE TO PAYMENT');
    lines.push(input.continueCheckoutUrl);
    lines.push('');
  }
  if (input.manageUrl.length > 0) {
    lines.push('MANAGE BOOKING');
    lines.push(input.manageUrl);
    lines.push('');
  }
  lines.push(
    'Save this email. You will need your booking reference, email, and the last four digits of your phone number to look up this booking later.',
  );
  lines.push('');
  lines.push(`— ${input.brandName}`);
  return lines.join('\n');
}

async function persistEmailSend(doc: Omit<EmailSendDocument, '_id'>): Promise<void> {
  const db = await getDb();
  await db.collection<EmailSendDocument>(COLLECTIONS.emailSends).insertOne(doc);
}

async function hasPaymentReminderEmailBeenSent(bookingId: string): Promise<boolean> {
  const db = await getDb();
  const existing = await db.collection<EmailSendDocument>(COLLECTIONS.emailSends).findOne({
    templateKey: BOOKING_PAYMENT_REMINDER_TEMPLATE_KEY,
    'payload.bookingId': bookingId,
    status: { $in: ['sent', 'mock_sent'] },
  });
  return existing !== null;
}

/**
 * Sends a payment reminder with booking reference, deadline, and manage-booking contact details.
 * Does not block checkout when email delivery fails.
 */
export async function executeSendBookingPaymentReminderEmail(input: {
  readonly bookingId: string;
  readonly transaction: PaymentTransactionRow | null;
}): Promise<void> {
  if (!process.env.MONGODB_URI) {
    return;
  }
  try {
    await runSendBookingPaymentReminderEmail(input);
  } catch (error: unknown) {
    console.error('[booking-email] executeSendBookingPaymentReminderEmail', error);
  }
}

async function runSendBookingPaymentReminderEmail(input: {
  readonly bookingId: string;
  readonly transaction: PaymentTransactionRow | null;
}): Promise<void> {
  if (await hasPaymentReminderEmailBeenSent(input.bookingId)) {
    return;
  }
  const booking = await findBookingById(input.bookingId);
  if (booking === null || booking.status !== 'pending' || booking.paymentStatus === 'paid') {
    return;
  }
  const transaction =
    input.transaction ??
    (booking.paymentTransactionId !== null
      ? await findPaymentTransactionById(booking.paymentTransactionId)
      : null);
  const transactionExpiresAtIso = transaction?.expiresAtIso ?? null;
  const expiresAt =
    booking.paymentExpiresAtIso !== null
      ? new Date(booking.paymentExpiresAtIso)
      : transactionExpiresAtIso !== null
        ? new Date(transactionExpiresAtIso)
        : null;
  if (expiresAt === null || !Number.isFinite(expiresAt.getTime())) {
    return;
  }
  const lead = await findLeadById(booking.leadId);
  const to = resolveRecipientEmail(lead, transaction);
  if (to === null) {
    return;
  }
  const contactName =
    (lead?.name?.trim().length ?? 0) > 0
      ? lead!.name.trim()
      : (transaction?.customerName?.trim() ?? 'Guest');
  const contactEmail =
    (lead?.email?.trim().length ?? 0) > 0 ? lead!.email.trim() : (transaction?.customerEmail?.trim() ?? '');
  const contactPhone = transaction?.customerPhone?.trim() ?? '';
  if (contactEmail.length === 0 || contactPhone.length === 0) {
    return;
  }
  const contactCompanyRaw = transaction?.customerCompany?.trim() ?? '';
  const contactCompany = contactCompanyRaw.length > 0 ? contactCompanyRaw : null;
  const customerName = contactName.length > 0 ? contactName : 'there';
  const startsAt = new Date(booking.startsAtIso);
  const timezone = booking.timezone.trim().length > 0 ? booking.timezone : PRIMARY_TIMEZONE;
  const dateLong = formatInTimeZone(startsAt, timezone, 'EEEE, MMMM d, yyyy');
  const timeLabel = formatInTimeZone(startsAt, timezone, 'h:mm a');
  const bookingReference = formatBookingReferenceId(booking.id);
  const brandName = await getResolvedSiteName();
  const siteOrigin = resolveAbsoluteSiteOrigin();
  const manageBookingEnabled = await readManageBookingEnabled();
  const manageUrl = manageBookingEnabled && siteOrigin.length > 0 ? `${siteOrigin}/book/manage` : '';
  const sessionMarketingRef =
    booking.quizSessionId !== undefined && booking.quizSessionId !== null
      ? encodeQuizSessionRefForMarketingUrl(booking.quizSessionId)
      : '';
  const continueCheckoutUrl =
    siteOrigin.length > 0 && sessionMarketingRef.length > 0
      ? `${siteOrigin}${buildMarketingBookSessionPath(sessionMarketingRef, booking.serviceKey)}`
      : '';
  const paymentDeadlineLabel = formatPaymentDeadlineLabel(expiresAt, timezone);
  const html = buildBookingPaymentReminderEmailHtml({
    brandName,
    customerName,
    bookingReference,
    dateLong,
    timeLabel,
    paymentDeadlineLabel,
    contactName,
    contactEmail,
    contactPhone,
    contactCompany,
    continueCheckoutUrl,
    manageUrl,
  });
  const text = buildPaymentReminderPlainText({
    brandName,
    customerName,
    bookingReference,
    dateLong,
    timeLabel,
    paymentDeadlineLabel,
    contactName,
    contactEmail,
    contactPhone,
    contactCompany,
    continueCheckoutUrl,
    manageUrl,
  });
  const subject = `Complete your payment — ${bookingReference}`;
  const basePayload: Record<string, unknown> = {
    bookingId: booking.id,
    transactionId: transaction?.id ?? null,
    bookingReference,
  };
  const outcome = await executeDispatchTransactionalEmail({ to, subject, html, text });
  if (outcome.kind === 'audit_only') {
    await persistEmailSend({
      to,
      templateKey: BOOKING_PAYMENT_REMINDER_TEMPLATE_KEY,
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
      templateKey: BOOKING_PAYMENT_REMINDER_TEMPLATE_KEY,
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
    templateKey: BOOKING_PAYMENT_REMINDER_TEMPLATE_KEY,
    payload: { ...persistPayload, provider: outcome.provider },
    status: 'sent',
    providerMessageId: outcome.providerMessageId,
    createdAt: new Date(),
  });
}

export function buildBookingPaymentReminderSubject(bookingReference: string): string {
  return `Complete your payment — ${bookingReference}`;
}
