import { COLLECTIONS } from '@/domain/collections';
import type { PaymentPolicy, PaymentStatus } from '@/domain/payment-types';
import type { BookingDocument, EmailSendDocument } from '@/domain/types';
import { findBookingById } from '@/lib/data/bookings';
import { getResolvedSiteName } from '@/lib/data/app-settings';
import { findLeadById } from '@/lib/data/leads';
import { type PaymentTransactionRow } from '@/lib/data/payment-transactions';
import { formatBookingReferenceId } from '@/lib/marketing/booking-reference';
import {
  buildTransactionalEmailBrandNameRow,
  resolveAbsoluteSiteOrigin,
} from '@/lib/email/email-brand';
import { buildPaymentReminderDedupKey } from '@/lib/email/payment-reminder-dedup-key';
import { executeDispatchTransactionalEmail } from '@/lib/email/send-transactional-email';
import { readManageBookingEnabled } from '@/lib/marketing/manage-booking-gate';
import { buildMarketingBookSessionPath } from '@/lib/marketing/quiz-session-marketing-ref';
import { encodeQuizSessionRefForMarketingUrl } from '@/lib/server/quiz-session-marketing-ref-crypto';
import { getDb } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
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
  readonly bookingReference: string | null;
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
  const preheader =
    input.bookingReference !== null
      ? `Complete payment for booking ${input.bookingReference} on or before ${input.paymentDeadlineLabel}.`
      : `Complete payment for your consultation on or before ${input.paymentDeadlineLabel}.`;
  const bookingReferenceRow =
    input.bookingReference !== null
      ? `<tr><td style="padding:0 0 16px 0;font-family:${EMAIL_FONT_STACK};font-size:13px;line-height:20px;color:#71717a;">Booking reference: <strong style="color:#18181b;">${escapeHtml(input.bookingReference)}</strong></td></tr>`
      : '';
  const emailTitle =
    input.bookingReference !== null
      ? escapeHtml(`Complete your payment — ${input.bookingReference}`)
      : 'Complete your payment';
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${emailTitle}</title>
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
${bookingReferenceRow}
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
  readonly bookingReference: string | null;
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
  ];
  if (input.bookingReference !== null) {
    lines.push(`Booking reference: ${input.bookingReference}`, '');
  }
  lines.push(
    'YOUR RESERVATION',
    `${input.dateLong} · ${input.timeLabel}`,
    '',
    'CONTACT ON FILE',
    `Name: ${input.contactName}`,
    `Email: ${input.contactEmail}`,
    `Phone: ${input.contactPhone}`,
  );
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

async function finalizePaymentReminderEmailSend(input: {
  readonly dedupKey: string;
  readonly to: string;
  readonly payload: Record<string, unknown>;
  readonly status: Exclude<EmailSendDocument['status'], 'sending'>;
  readonly providerMessageId?: string;
}): Promise<void> {
  const db = await getDb();
  const doc: Omit<EmailSendDocument, '_id'> = {
    to: input.to,
    templateKey: BOOKING_PAYMENT_REMINDER_TEMPLATE_KEY,
    paymentReminderDedupKey: input.dedupKey,
    payload: input.payload,
    status: input.status,
    createdAt: new Date(),
    ...(input.providerMessageId !== undefined ? { providerMessageId: input.providerMessageId } : {}),
  };
  const updated = await db.collection<EmailSendDocument>(COLLECTIONS.emailSends).updateOne(
    {
      templateKey: BOOKING_PAYMENT_REMINDER_TEMPLATE_KEY,
      paymentReminderDedupKey: input.dedupKey,
    },
    { $set: doc },
  );
  if (updated.matchedCount === 0) {
    await persistEmailSend(doc);
  }
}

function isPaymentReminderPolicy(policy: PaymentPolicy): boolean {
  return policy === 'pay_before_booking' || policy === 'pay_after_hold';
}

function isTransactionAwaitingPayment(status: PaymentStatus): boolean {
  return status === 'pending' || status === 'processing';
}

async function isPaymentReminderAlreadySent(input: {
  readonly dedupKey: string;
  readonly bookingId: string | null;
}): Promise<boolean> {
  const db = await getDb();
  const dedupeFilters: Record<string, unknown>[] = [
    { paymentReminderDedupKey: input.dedupKey },
    { 'payload.paymentReminderDedupKey': input.dedupKey },
  ];
  if (input.bookingId !== null) {
    dedupeFilters.push({ 'payload.bookingId': input.bookingId });
  }
  const existingEmail = await db.collection<EmailSendDocument>(COLLECTIONS.emailSends).findOne({
    templateKey: BOOKING_PAYMENT_REMINDER_TEMPLATE_KEY,
    status: { $in: ['sent', 'mock_sent', 'sending'] },
    $or: dedupeFilters,
  });
  if (existingEmail !== null) {
    return true;
  }
  if (input.bookingId === null) {
    return false;
  }
  const booking = await db.collection<BookingDocument>(COLLECTIONS.bookings).findOne(
    { _id: new ObjectId(input.bookingId), paymentReminderEmailSentAt: { $exists: true } },
    { projection: { _id: 1 } },
  );
  return booking !== null;
}

async function tryClaimPaymentReminderSend(input: {
  readonly dedupKey: string;
  readonly bookingId: string | null;
}): Promise<boolean> {
  if (await isPaymentReminderAlreadySent(input)) {
    return false;
  }
  const db = await getDb();
  if (input.bookingId !== null) {
    const claimNow = new Date();
    const claimResult = await db.collection<BookingDocument>(COLLECTIONS.bookings).updateOne(
      {
        _id: new ObjectId(input.bookingId),
        status: 'pending',
        paymentReminderEmailSentAt: { $exists: false },
        $or: [
          { paymentStatus: { $exists: false } },
          { paymentStatus: null },
          { paymentStatus: { $nin: ['paid'] } },
        ],
      },
      { $set: { paymentReminderEmailSentAt: claimNow, updatedAt: claimNow } },
    );
    return claimResult.modifiedCount === 1;
  }
  const claimResult = await db.collection<EmailSendDocument>(COLLECTIONS.emailSends).findOneAndUpdate(
    {
      templateKey: BOOKING_PAYMENT_REMINDER_TEMPLATE_KEY,
      paymentReminderDedupKey: input.dedupKey,
    },
    {
      $setOnInsert: {
        templateKey: BOOKING_PAYMENT_REMINDER_TEMPLATE_KEY,
        paymentReminderDedupKey: input.dedupKey,
        payload: { paymentReminderDedupKey: input.dedupKey },
        status: 'sending',
        to: '',
        createdAt: new Date(),
      },
    },
    { upsert: true, returnDocument: 'before' },
  );
  return claimResult === null;
}

async function releasePaymentReminderClaim(input: {
  readonly dedupKey: string;
  readonly bookingId: string | null;
}): Promise<void> {
  const db = await getDb();
  if (input.bookingId !== null) {
    await db.collection<BookingDocument>(COLLECTIONS.bookings).updateOne(
      { _id: new ObjectId(input.bookingId) },
      { $unset: { paymentReminderEmailSentAt: '' }, $set: { updatedAt: new Date() } },
    );
    return;
  }
  await db.collection<EmailSendDocument>(COLLECTIONS.emailSends).deleteOne({
    templateKey: BOOKING_PAYMENT_REMINDER_TEMPLATE_KEY,
    paymentReminderDedupKey: input.dedupKey,
    status: 'sending',
  });
}

/**
 * Sends a payment reminder with booking reference, deadline, and manage-booking contact details.
 * Does not block checkout when email delivery fails.
 */
export async function executeSendBookingPaymentReminderEmail(input: {
  readonly transaction: PaymentTransactionRow;
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
  readonly transaction: PaymentTransactionRow;
}): Promise<void> {
  const transaction = input.transaction;
  if (!isPaymentReminderPolicy(transaction.paymentPolicy)) {
    return;
  }
  if (!isTransactionAwaitingPayment(transaction.status)) {
    return;
  }
  const resolvedBookingId = transaction.bookingId;
  const booking = resolvedBookingId !== null ? await findBookingById(resolvedBookingId) : null;
  if (resolvedBookingId !== null) {
    if (booking === null || booking.status !== 'pending' || booking.paymentStatus === 'paid') {
      return;
    }
  } else if (transaction.paymentPolicy !== 'pay_before_booking') {
    return;
  }
  const transactionExpiresAtIso = transaction.expiresAtIso ?? null;
  const expiresAt =
    booking?.paymentExpiresAtIso !== null && booking?.paymentExpiresAtIso !== undefined
      ? new Date(booking.paymentExpiresAtIso)
      : transactionExpiresAtIso !== null
        ? new Date(transactionExpiresAtIso)
        : null;
  if (expiresAt === null || !Number.isFinite(expiresAt.getTime())) {
    return;
  }
  const lead =
    booking !== null
      ? await findLeadById(booking.leadId)
      : transaction.leadId !== null
        ? await findLeadById(transaction.leadId)
        : null;
  const to = resolveRecipientEmail(lead, transaction);
  if (to === null) {
    return;
  }
  const contactName =
    (lead?.name?.trim().length ?? 0) > 0
      ? lead!.name.trim()
      : (transaction.customerName?.trim() ?? 'Guest');
  const contactEmail =
    (lead?.email?.trim().length ?? 0) > 0 && lead!.email.trim() !== '—'
      ? lead!.email.trim()
      : (transaction.customerEmail?.trim() ?? '');
  const contactPhone = transaction.customerPhone?.trim() ?? '';
  if (contactEmail.length === 0 || contactPhone.length === 0) {
    return;
  }
  const dedupKey = buildPaymentReminderDedupKey({
    bookingId: booking?.id ?? resolvedBookingId,
    transaction,
  });
  const claimed = await tryClaimPaymentReminderSend({
    dedupKey,
    bookingId: booking?.id ?? resolvedBookingId,
  });
  if (!claimed) {
    return;
  }
  const releaseClaim = async (): Promise<void> => {
    await releasePaymentReminderClaim({
      dedupKey,
      bookingId: booking?.id ?? resolvedBookingId,
    });
  };
  const contactCompanyRaw = transaction.customerCompany?.trim() ?? '';
  const contactCompany = contactCompanyRaw.length > 0 ? contactCompanyRaw : null;
  const customerName = contactName.length > 0 ? contactName : 'there';
  const startsAtIso = booking?.startsAtIso ?? transaction.startsAtIso;
  const timezone =
    booking !== null && booking.timezone.trim().length > 0
      ? booking.timezone
      : transaction.timezone.trim().length > 0
        ? transaction.timezone
        : PRIMARY_TIMEZONE;
  const startsAt = new Date(startsAtIso);
  const dateLong = formatInTimeZone(startsAt, timezone, 'EEEE, MMMM d, yyyy');
  const timeLabel = formatInTimeZone(startsAt, timezone, 'h:mm a');
  const bookingReference = booking !== null ? formatBookingReferenceId(booking.id) : null;
  const brandName = await getResolvedSiteName();
  const siteOrigin = resolveAbsoluteSiteOrigin();
  const manageBookingEnabled = await readManageBookingEnabled();
  const manageUrl =
    manageBookingEnabled && siteOrigin.length > 0
      ? bookingReference !== null
        ? `${siteOrigin}/book/manage?bookingReference=${encodeURIComponent(bookingReference)}`
        : `${siteOrigin}/book/manage`
      : '';
  const quizSessionIdHex =
    booking?.quizSessionId !== undefined && booking?.quizSessionId !== null
      ? booking.quizSessionId
      : transaction.quizSessionIdHex;
  const sessionMarketingRef =
    quizSessionIdHex !== null && quizSessionIdHex.trim().length > 0
      ? encodeQuizSessionRefForMarketingUrl(quizSessionIdHex.trim())
      : '';
  const serviceKey = booking?.serviceKey ?? transaction.serviceKey;
  const continueCheckoutUrl =
    siteOrigin.length > 0 && sessionMarketingRef.length > 0
      ? `${siteOrigin}${buildMarketingBookSessionPath(sessionMarketingRef, serviceKey)}`
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
  const subject =
    bookingReference !== null
      ? buildBookingPaymentReminderSubject(bookingReference)
      : 'Complete your payment for your consultation booking';
  const basePayload: Record<string, unknown> = {
    bookingId: booking?.id ?? null,
    transactionId: transaction.id,
    paymentReminderDedupKey: dedupKey,
    ...(bookingReference !== null ? { bookingReference } : {}),
  };
  const outcome = await executeDispatchTransactionalEmail({ to, subject, html, text });
  if (outcome.kind === 'audit_only') {
    await finalizePaymentReminderEmailSend({
      dedupKey,
      to,
      payload: { ...basePayload, channel: 'audit_only' },
      status: 'mock_sent',
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
    await finalizePaymentReminderEmailSend({
      dedupKey,
      to: outcome.persistTo,
      payload: {
        ...persistPayload,
        errorMessage: outcome.errorMessage,
        errorName: outcome.errorName,
        statusCode: outcome.statusCode,
      },
      status: 'failed',
    });
    await releaseClaim();
    return;
  }
  await finalizePaymentReminderEmailSend({
    dedupKey,
    to: outcome.persistTo,
    payload: { ...persistPayload, provider: outcome.provider },
    status: 'sent',
    providerMessageId: outcome.providerMessageId,
  });
}

export function buildBookingPaymentReminderSubject(bookingReference: string): string {
  return `Complete your payment — ${bookingReference}`;
}
