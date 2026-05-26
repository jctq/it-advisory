import { ObjectId } from 'mongodb';
import { COLLECTIONS } from '@/domain/collections';
import type { EmailSendDocument } from '@/domain/types';
import { resolveBookingAttendeeContact } from '@/lib/booking/resolve-booking-attendee-contact';
import { findBookingById } from '@/lib/data/bookings';
import { findLeadById } from '@/lib/data/leads';
import { findPaymentTransactionById } from '@/lib/data/payment-transactions';
import { getResolvedSiteName } from '@/lib/data/app-settings';
import { executeDispatchTransactionalEmail } from '@/lib/email/send-transactional-email';
import { formatBookingReferenceId } from '@/lib/marketing/booking-reference';
import { getDb } from '@/lib/mongodb';
import { formatInTimeZone } from 'date-fns-tz';

const BOOKING_FATHOM_NOTES_TEMPLATE_KEY = 'booking_fathom_notes';
const EMAIL_ADDRESS_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SUMMARY_PREVIEW_MAX_LENGTH = 500 as const;

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
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px 0;"><tr><td bgcolor="#0f172a" style="background-color:#0f172a;border-radius:8px;"><a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:14px 28px;font-family:${EMAIL_FONT_STACK};font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">${escapeHtml(label)}</a></td></tr></table>`;
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
  const lead = await findLeadById(booking.leadId);
  const transaction =
    booking.paymentTransactionId !== null
      ? await findPaymentTransactionById(booking.paymentTransactionId)
      : null;
  const attendee = resolveBookingAttendeeContact({ lead, transaction });
  if (attendee === null || !EMAIL_ADDRESS_PATTERN.test(attendee.email)) {
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
  const actionItemsHtml =
    actionItems.length > 0
      ? `<ul style="margin:12px 0 0 0;padding-left:20px;font-family:${EMAIL_FONT_STACK};font-size:14px;line-height:22px;color:#3f3f46;">${actionItems.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
      : '';
  const summaryHtml =
    summaryPreview.length > 0
      ? `<p style="margin:12px 0 0 0;font-family:${EMAIL_FONT_STACK};font-size:14px;line-height:22px;color:#3f3f46;">${escapeHtml(summaryPreview)}</p>`
      : '';
  const html = `<!DOCTYPE html><html><body style="margin:0;padding:24px;background:#fafafa;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e4e4e7;border-radius:12px;padding:28px;"><tr><td style="font-family:${EMAIL_FONT_STACK};font-size:20px;font-weight:600;color:#18181b;">Your consultation notes are ready</td></tr><tr><td style="padding-top:16px;font-family:${EMAIL_FONT_STACK};font-size:15px;line-height:24px;color:#3f3f46;">Hi ${escapeHtml(attendee.displayName)}, thank you for your session on ${escapeHtml(dateLong)} at ${escapeHtml(timeLabel)}.</td></tr><tr><td style="padding-top:20px;">${buildBulletproofButton('View meeting notes', shareUrl)}</td></tr><tr><td style="font-family:${EMAIL_FONT_STACK};font-size:13px;color:#71717a;">Booking reference: ${escapeHtml(bookingReference)}</td></tr><tr><td>${summaryHtml}${actionItemsHtml}</td></tr><tr><td style="padding-top:24px;border-top:1px solid #e4e4e7;font-family:${EMAIL_FONT_STACK};font-size:12px;color:#71717a;">Sent by ${escapeHtml(brandName)}.</td></tr></table></body></html>`;
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
    return;
  }
  const db = await getDb();
  const now = new Date();
  await db.collection(COLLECTIONS.bookings).updateOne(
    { _id: new ObjectId(booking.id) },
    { $set: { fathomNotesEmailSentAt: now, updatedAt: now } },
  );
  const emailDoc: Omit<EmailSendDocument, '_id'> = {
    to: attendee.email,
    templateKey: BOOKING_FATHOM_NOTES_TEMPLATE_KEY,
    payload: { bookingId: booking.id, subject },
    status: 'sent',
    createdAt: now,
  };
  await db.collection<EmailSendDocument>(COLLECTIONS.emailSends).insertOne(emailDoc);
}
