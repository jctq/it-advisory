import { ObjectId } from 'mongodb';
import { COLLECTIONS } from '@/domain/collections';
import type { EmailSendDocument } from '@/domain/types';
import { resolveBookingAttendeeContact } from '@/lib/booking/resolve-booking-attendee-contact';
import { findBookingById } from '@/lib/data/bookings';
import { findLeadById } from '@/lib/data/leads';
import { findPaymentTransactionById } from '@/lib/data/payment-transactions';
import { getResolvedSiteName } from '@/lib/data/app-settings';
import {
  buildTransactionalEmailBrandNameRow,
  resolveAbsoluteSiteOrigin,
} from '@/lib/email/email-brand';
import { executeDispatchTransactionalEmail } from '@/lib/email/send-transactional-email';
import { formatBookingReferenceId } from '@/lib/marketing/booking-reference';
import { getDb } from '@/lib/mongodb';
import { formatInTimeZone } from 'date-fns-tz';

const BOOKING_FATHOM_NOTES_TEMPLATE_KEY = 'booking_fathom_notes';
const EMAIL_ADDRESS_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SUMMARY_PREVIEW_MAX_LENGTH = 500 as const;
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

function truncateSummary(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.length <= SUMMARY_PREVIEW_MAX_LENGTH) {
    return trimmed;
  }
  return `${trimmed.slice(0, SUMMARY_PREVIEW_MAX_LENGTH - 1)}…`;
}

function buildBulletproofButton(label: string, href: string): string {
  const safeHref = escapeHtml(href);
  const safeLabel = escapeHtml(label);
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px 0;border-collapse:separate;mso-table-lspace:0pt;mso-table-rspace:0pt;"><tr><td bgcolor="#0f172a" style="background-color:#0f172a;border-radius:8px;mso-padding-alt:0;"><a href="${safeHref}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:14px 28px;font-family:${EMAIL_FONT_STACK};font-size:15px;font-weight:600;line-height:20px;color:#ffffff;text-decoration:none;border-radius:8px;">${safeLabel}</a></td></tr></table>`;
}

export function buildBookingFathomNotesEmailHtml(input: {
  readonly brandName: string;
  readonly siteOrigin: string;
  readonly attendeeDisplayName: string;
  readonly bookingReference: string;
  readonly dateLong: string;
  readonly timeLabel: string;
  readonly shareUrl: string;
  readonly summary: string;
  readonly actionItems: readonly string[];
}): string {
  const summaryPreview = truncateSummary(input.summary);
  const actionItemsHtml =
    input.actionItems.length > 0
      ? `<ul style="margin:12px 0 0 0;padding-left:20px;font-family:${EMAIL_FONT_STACK};font-size:14px;line-height:22px;color:#3f3f46;">${input.actionItems.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
      : '';
  const summaryHtml =
    summaryPreview.length > 0
      ? `<p style="margin:12px 0 0 0;font-family:${EMAIL_FONT_STACK};font-size:14px;line-height:22px;color:#3f3f46;">${escapeHtml(summaryPreview)}</p>`
      : '';
  const preheader = `Your ${input.brandName} consultation notes are ready. Reference ${input.bookingReference}.`;
  const brandNameRow = buildTransactionalEmailBrandNameRow({
    brandName: input.brandName,
    fontStack: EMAIL_FONT_STACK,
  });
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta http-equiv="X-UA-Compatible" content="IE=edge" />
<title>${escapeHtml(`Meeting notes — ${input.bookingReference}`)}</title>
<!--[if mso]><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#f4f4f5;width:0;opacity:0;">
${escapeHtml(preheader)}&#8204;&nbsp;&#8204;&nbsp;&#8204;&nbsp;&#8204;&nbsp;&#8204;&nbsp;&#8204;&nbsp;&#8204;&nbsp;&#8204;&nbsp;
</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0;padding:0;background-color:#f4f4f5;border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="${EMAIL_INNER_WIDTH_PX}" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:${EMAIL_INNER_WIDTH_PX}px;border-collapse:separate;mso-table-lspace:0pt;mso-table-rspace:0pt;">
<tr><td style="padding:0;background-color:#ffffff;border:1px solid #e4e4e7;border-radius:12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding:32px 28px 28px 28px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${brandNameRow}<tr><td style="padding:0 0 8px 0;font-family:${EMAIL_FONT_STACK};font-size:20px;font-weight:600;line-height:28px;color:#18181b;">Your consultation notes are ready</td></tr><tr><td style="padding:0 0 20px 0;font-family:${EMAIL_FONT_STACK};font-size:15px;line-height:24px;color:#3f3f46;">Hi ${escapeHtml(input.attendeeDisplayName)}, thank you for your session on ${escapeHtml(input.dateLong)} at ${escapeHtml(input.timeLabel)}.</td></tr><tr><td>${buildBulletproofButton('View meeting notes', input.shareUrl)}</td></tr><tr><td style="padding:0 0 16px 0;font-family:${EMAIL_FONT_STACK};font-size:13px;line-height:20px;color:#71717a;">Booking reference: ${escapeHtml(input.bookingReference)}</td></tr><tr><td>${summaryHtml}${actionItemsHtml}</td></tr><tr><td style="padding:24px 0 0 0;border-top:1px solid #e4e4e7;"><p style="margin:0;font-family:${EMAIL_FONT_STACK};font-size:12px;line-height:18px;color:#71717a;">Sent by ${escapeHtml(input.brandName)}.</p></td></tr></table>
</td></tr></table>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

export async function executeSendBookingFathomNotesEmail(input: { readonly bookingId: string }): Promise<void> {
  if (!process.env.MONGODB_URI) {
    return;
  }
  try {
    await runSendBookingFathomNotesEmail(input);
  } catch (error: unknown) {
    console.error('[booking-fathom-email] executeSendBookingFathomNotesEmail', error);
  }
}

async function runSendBookingFathomNotesEmail(input: { readonly bookingId: string }): Promise<void> {
  const booking = await findBookingById(input.bookingId);
  if (booking === null || booking.status !== 'confirmed' || booking.recordingOptIn !== true) {
    return;
  }
  const shareUrl = booking.fathomShareUrl?.trim() ?? '';
  if (shareUrl.length === 0) {
    return;
  }
  if (booking.fathomNotesEmailSentAtIso !== null && booking.fathomNotesEmailSentAtIso !== undefined) {
    return;
  }
  const db = await getDb();
  const claimNow = new Date();
  const claimResult = await db.collection(COLLECTIONS.bookings).updateOne(
    {
      _id: new ObjectId(booking.id),
      fathomNotesEmailSentAt: { $exists: false },
    },
    { $set: { fathomNotesEmailSentAt: claimNow, updatedAt: claimNow } },
  );
  if (claimResult.modifiedCount === 0) {
    return;
  }
  const lead = await findLeadById(booking.leadId);
  const transaction =
    booking.paymentTransactionId !== null
      ? await findPaymentTransactionById(booking.paymentTransactionId)
      : null;
  const attendee = resolveBookingAttendeeContact({ lead, transaction });
  if (attendee === null || !EMAIL_ADDRESS_PATTERN.test(attendee.email)) {
    await db.collection(COLLECTIONS.bookings).updateOne(
      { _id: new ObjectId(booking.id) },
      { $unset: { fathomNotesEmailSentAt: '' }, $set: { updatedAt: new Date() } },
    );
    return;
  }
  const brandName = await getResolvedSiteName();
  const bookingReference = formatBookingReferenceId(booking.id);
  const startsAt = new Date(booking.startsAtIso);
  const dateLong = formatInTimeZone(startsAt, booking.timezone, 'EEEE, MMMM d, yyyy');
  const timeLabel = formatInTimeZone(startsAt, booking.timezone, 'h:mm a');
  const summaryPreview = truncateSummary(booking.fathomSummary ?? '');
  const actionItems = booking.fathomActionItems ?? [];
  const subject = `Meeting notes — ${bookingReference}`;
  const siteOrigin = resolveAbsoluteSiteOrigin();
  const html = buildBookingFathomNotesEmailHtml({
    brandName,
    siteOrigin,
    attendeeDisplayName: attendee.displayName,
    bookingReference,
    dateLong,
    timeLabel,
    shareUrl,
    summary: booking.fathomSummary ?? '',
    actionItems,
  });
  const plainLines = [
    'Your consultation notes are ready',
    '',
    `Hi ${attendee.displayName},`,
    `Session: ${dateLong} at ${timeLabel}`,
    `Booking reference: ${bookingReference}`,
    '',
    `View meeting notes: ${shareUrl}`,
  ];
  if (summaryPreview.length > 0) {
    plainLines.push('', 'Summary:', summaryPreview);
  }
  if (actionItems.length > 0) {
    plainLines.push('', 'Action items:', ...actionItems.map((item) => `- ${item}`));
  }
  const outcome = await executeDispatchTransactionalEmail({
    to: attendee.email,
    subject,
    html,
    text: plainLines.join('\n'),
  });
  if (outcome.kind !== 'sent') {
    await db.collection(COLLECTIONS.bookings).updateOne(
      { _id: new ObjectId(booking.id) },
      { $unset: { fathomNotesEmailSentAt: '' }, $set: { updatedAt: new Date() } },
    );
    return;
  }
  const emailDoc: Omit<EmailSendDocument, '_id'> = {
    to: attendee.email,
    templateKey: BOOKING_FATHOM_NOTES_TEMPLATE_KEY,
    payload: { bookingId: booking.id, subject },
    status: 'sent',
    createdAt: claimNow,
  };
  await db.collection<EmailSendDocument>(COLLECTIONS.emailSends).insertOne(emailDoc);
}
