import { COLLECTIONS } from '@/domain/collections';
import type { EmailSendDocument } from '@/domain/types';
import type { PaymentGatewayId } from '@/domain/payment-types';
import { findBookingById } from '@/lib/data/bookings';
import { findLeadById } from '@/lib/data/leads';
import { findPaymentTransactionById, type PaymentTransactionRow } from '@/lib/data/payment-transactions';
import { getDb } from '@/lib/mongodb';
import { getCatalogServiceByKey } from '@/lib/data/public-catalog-services';
import { formatBookingReferenceId } from '@/lib/marketing/booking-reference';
import { readManageBookingEnabled } from '@/lib/marketing/manage-booking-gate';
import type { CatalogServiceKind } from '@/domain/monetization-types';
import { formatInTimeZone } from 'date-fns-tz';
import { executeDispatchTransactionalEmail } from '@/lib/email/send-transactional-email';
import {
  BOOKING_SESSION_CALENDAR_DURATION_MINUTES,
  buildBookingCalendarLinkBundle,
  type BookingCalendarLinkBundle,
} from '@techmd/domain/booking-calendar-links';

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

type BookingCatalogEmailDetails = {
  readonly title: string;
  readonly description: string;
  readonly durationLabel: string;
  readonly amountLabel: string;
  readonly kind: CatalogServiceKind;
  readonly sessionsIncluded: number | null;
};

function buildCatalogServiceSectionHtml(catalog: BookingCatalogEmailDetails): string {
  const rows: string[] = [
    buildEmailDetailRow('Service', catalog.title),
    buildEmailDetailRow('Duration', catalog.durationLabel),
    buildEmailDetailRow('Price', catalog.amountLabel),
  ];
  if (catalog.kind === 'package' && catalog.sessionsIncluded !== null) {
    rows.push(buildEmailDetailRow('Package', `${catalog.sessionsIncluded} sessions included`));
  }
  const descriptionBlock =
    catalog.description.trim().length > 0
      ? `<tr><td colspan="2" style="padding:12px 0 0 0;font-family:${EMAIL_FONT_STACK};font-size:14px;line-height:22px;color:#3f3f46;">${escapeHtml(catalog.description)}</td></tr>`
      : '';
  return `${buildEmailSectionHeading('Your service')}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px 0;border-collapse:separate;mso-table-lspace:0pt;mso-table-rspace:0pt;"><tr><td style="padding:18px 20px;border:1px solid #e4e4e7;border-radius:10px;background-color:#fafafa;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tbody>${rows.join('')}${descriptionBlock}</tbody></table></td></tr></table>`;
}

function buildCatalogServicePlainLines(catalog: BookingCatalogEmailDetails): string[] {
  const lines: string[] = ['YOUR SERVICE'];
  lines.push(`Service: ${catalog.title}`);
  lines.push(`Duration: ${catalog.durationLabel}`);
  lines.push(`Price: ${catalog.amountLabel}`);
  if (catalog.kind === 'package' && catalog.sessionsIncluded !== null) {
    lines.push(`Package: ${catalog.sessionsIncluded} sessions included`);
  }
  if (catalog.description.trim().length > 0) {
    lines.push(catalog.description.trim());
  }
  return lines;
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

/**
 * Prefer public app URL; fall back to Vercel deployment host so transactional links work when only `VERCEL_URL` is set.
 */
function resolveAbsoluteSiteOrigin(): string {
  const fromPublic = resolveMarketingSiteBaseUrl();
  if (fromPublic.length > 0) {
    return fromPublic;
  }
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel === undefined || vercel.length === 0) {
    return '';
  }
  if (vercel.startsWith('http://') || vercel.startsWith('https://')) {
    return vercel.replace(/\/$/, '');
  }
  return `https://${vercel.replace(/\/$/, '')}`;
}

function formatAmountPhp(centavos: number): string {
  const pesos = centavos / 100;
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(pesos);
}

const TRANSACTIONAL_EMAIL_BRAND_NAME = 'TechMD';
const EMAIL_INNER_WIDTH_PX = 600;
const EMAIL_FONT_STACK =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif";

function buildEmailSectionHeading(heading: string): string {
  return `<p style="margin:0 0 12px 0;font-family:${EMAIL_FONT_STACK};font-size:11px;font-weight:600;line-height:16px;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;">${escapeHtml(heading)}</p>`;
}

function buildEmailDetailRow(label: string, value: string): string {
  return `<tr><td style="padding:6px 0;font-family:${EMAIL_FONT_STACK};font-size:14px;line-height:22px;color:#52525b;width:148px;vertical-align:top;"><strong style="color:#18181b;">${escapeHtml(label)}</strong></td><td style="padding:6px 0;font-family:${EMAIL_FONT_STACK};font-size:14px;line-height:22px;color:#18181b;vertical-align:top;">${escapeHtml(value)}</td></tr>`;
}

function buildBulletproofButton(label: string, href: string): string {
  const safeHref = escapeHtml(href);
  const safeLabel = escapeHtml(label);
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px 0;border-collapse:separate;mso-table-lspace:0pt;mso-table-rspace:0pt;"><tr><td bgcolor="#0f172a" style="background-color:#0f172a;border-radius:8px;mso-padding-alt:0;"><a href="${safeHref}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:14px 28px;font-family:${EMAIL_FONT_STACK};font-size:15px;font-weight:600;line-height:20px;color:#ffffff;text-decoration:none;border-radius:8px;">${safeLabel}</a></td></tr></table>`;
}

function buildCalendarLinksBlock(input: {
  readonly googleCalendarUrl: string;
  readonly outlookCalendarUrl: string;
  readonly icsDataUrl: string;
}): string {
  const googleHref = escapeHtml(input.googleCalendarUrl);
  const outlookHref = escapeHtml(input.outlookCalendarUrl);
  const icsHref = escapeHtml(input.icsDataUrl);
  return `${buildEmailSectionHeading('Add to calendar')}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px 0;border-collapse:separate;mso-table-lspace:0pt;mso-table-rspace:0pt;"><tr><td style="padding:16px 18px;border:1px solid #e4e4e7;border-radius:10px;background-color:#fafafa;font-family:${EMAIL_FONT_STACK};font-size:14px;line-height:24px;color:#3f3f46;"><a href="${googleHref}" style="color:#0f172a;font-weight:600;text-decoration:underline;">Google Calendar</a><span style="color:#a1a1aa;"> · </span><a href="${outlookHref}" style="color:#0f172a;font-weight:600;text-decoration:underline;">Outlook</a><span style="color:#a1a1aa;"> · </span><a href="${icsHref}" style="color:#0f172a;font-weight:600;text-decoration:underline;">Apple (.ics)</a></td></tr></table>`;
}

function buildConfirmationPlainText(input: {
  readonly customerName: string;
  readonly bookingReference: string;
  readonly serviceLabel: string;
  readonly dateLong: string;
  readonly timeLabel: string;
  readonly manageUrl: string;
  readonly meetingUrl: string | null;
  readonly calendarBundle: BookingCalendarLinkBundle;
  readonly catalogPlainLines: readonly string[] | null;
  readonly paymentPlainLines: readonly string[] | null;
}): string {
  const lines: string[] = [];
  lines.push(`Hi ${input.customerName},`);
  lines.push('');
  lines.push('Your booking is confirmed. Thank you — we have received your payment and reserved your slot.');
  lines.push('');
  if (input.catalogPlainLines !== null) {
    lines.push(...input.catalogPlainLines);
    lines.push('');
  }
  lines.push('RESERVATION');
  lines.push(`When: ${input.dateLong} · ${input.timeLabel}`);
  lines.push(`Booking reference: ${input.bookingReference}`);
  lines.push('');
  lines.push('ADD TO CALENDAR');
  lines.push(`Google Calendar: ${input.calendarBundle.googleCalendarUrl}`);
  lines.push(`Outlook: ${input.calendarBundle.outlookCalendarUrl}`);
  lines.push(`Apple (.ics): ${input.calendarBundle.icsDataUrl}`);
  lines.push('');
  if (input.meetingUrl !== null && input.meetingUrl.trim().length > 0) {
    lines.push('VIDEO MEETING');
    lines.push(input.meetingUrl.trim());
    lines.push('');
  } else {
    lines.push('Your meeting link will follow in a separate message if your advisor attaches one to this booking.');
    lines.push('');
  }
  if (input.manageUrl.length > 0) {
    lines.push('MANAGE BOOKING');
    lines.push(input.manageUrl);
    lines.push('');
  } else {
    lines.push('To view or manage this booking, open the TechMD site and use Manage booking with your reference, email, and phone last four.');
    lines.push('');
  }
  if (input.paymentPlainLines !== null) {
    lines.push(...input.paymentPlainLines);
    lines.push('');
  }
  lines.push('—');
  lines.push(`This message was sent automatically by ${TRANSACTIONAL_EMAIL_BRAND_NAME}. If you did not make this booking, please contact support.`);
  return lines.join('\n');
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
  readonly siteOrigin: string;
  readonly calendarBundle: BookingCalendarLinkBundle;
  readonly catalogSectionHtml: string | null;
  readonly paymentSectionHtml: string | null;
}): string {
  const preheader = `Your ${TRANSACTIONAL_EMAIL_BRAND_NAME} consultation is confirmed. Reference ${input.bookingReference}.`;
  const trimmedMeeting =
    input.meetingUrl !== null && input.meetingUrl.trim().length > 0 ? input.meetingUrl.trim() : '';
  const logoBlock =
    input.siteOrigin.length > 0
      ? `<tr><td style="padding:0 0 24px 0;"><img src="${escapeHtml(`${input.siteOrigin}/brand/techmd-logo-full.png`)}" width="152" alt="${escapeHtml(TRANSACTIONAL_EMAIL_BRAND_NAME)}" style="display:block;width:152px;max-width:100%;height:auto;border:0;outline:none;text-decoration:none;" /></td></tr>`
      : `<tr><td style="padding:0 0 16px 0;font-family:${EMAIL_FONT_STACK};font-size:22px;font-weight:700;line-height:28px;color:#0f172a;letter-spacing:-0.02em;">${escapeHtml(TRANSACTIONAL_EMAIL_BRAND_NAME)}</td></tr>`;
  const reservationRows = [
    buildEmailDetailRow('When', `${input.dateLong} · ${input.timeLabel}`),
    buildEmailDetailRow('Booking reference', input.bookingReference),
  ].join('');
  const reservationCard = `${buildEmailSectionHeading('Reservation details')}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px 0;border-collapse:separate;mso-table-lspace:0pt;mso-table-rspace:0pt;"><tr><td style="padding:18px 20px;border:1px solid #e4e4e7;border-radius:10px;background-color:#fafafa;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${reservationRows}</table></td></tr></table>`;
  const calendarHtml = buildCalendarLinksBlock(input.calendarBundle);
  const meetingSection =
    trimmedMeeting.length > 0
      ? `${buildEmailSectionHeading('Video meeting')}${buildBulletproofButton('Join video meeting', trimmedMeeting)}<p style="margin:0 0 28px 0;font-family:${EMAIL_FONT_STACK};font-size:13px;line-height:20px;color:#52525b;word-break:break-word;">If the button above does not open your call, copy this link into your browser:<br /><a href="${escapeHtml(trimmedMeeting)}" style="color:#1d4ed8;text-decoration:underline;">${escapeHtml(trimmedMeeting)}</a></p>`
      : `<p style="margin:0 0 28px 0;font-family:${EMAIL_FONT_STACK};font-size:14px;line-height:22px;color:#52525b;">Your meeting link will follow in a separate message if your advisor attaches one to this booking.</p>`;
  const manageSection =
    input.manageUrl.length > 0
      ? `${buildEmailSectionHeading('Manage booking')}<p style="margin:0 0 12px 0;font-family:${EMAIL_FONT_STACK};font-size:14px;line-height:22px;color:#52525b;">You will need your booking reference, email, and the last four digits of your phone number.</p>${buildBulletproofButton('View or manage booking', input.manageUrl)}`
      : `<p style="margin:0 0 28px 0;font-family:${EMAIL_FONT_STACK};font-size:14px;line-height:22px;color:#52525b;">To update this reservation, visit the ${escapeHtml(TRANSACTIONAL_EMAIL_BRAND_NAME)} website and use <strong style="color:#18181b;">Manage booking</strong> with your reference, email, and phone last four.</p>`;
  const catalogBlock = input.catalogSectionHtml ?? '';
  const paymentBlock =
    input.paymentSectionHtml !== null && input.paymentSectionHtml.length > 0
      ? `${buildEmailSectionHeading('Payment')}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 8px 0;"><tr><td style="padding:16px 18px;border:1px solid #e4e4e7;border-radius:10px;background-color:#fafafa;">${input.paymentSectionHtml}</td></tr></table>`
      : '';
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta http-equiv="X-UA-Compatible" content="IE=edge" />
<title>${escapeHtml(`Booking confirmed — ${input.bookingReference}`)}</title>
<!--[if mso]><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#f4f4f5;width:0;opacity:0;">
${escapeHtml(preheader)}&#8204;&nbsp;&#8204;&nbsp;&#8204;&nbsp;&#8204;&nbsp;&#8204;&nbsp;&#8204;&nbsp;&#8204;&nbsp;&#8204;&nbsp;
</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0;padding:0;background-color:#f4f4f5;border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="${EMAIL_INNER_WIDTH_PX}" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:${EMAIL_INNER_WIDTH_PX}px;border-collapse:separate;mso-table-lspace:0pt;mso-table-rspace:0pt;">
<tr><td style="padding:32px 28px 28px 28px;background-color:#ffffff;border:1px solid #e4e4e7;border-radius:12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${logoBlock}<tr><td style="padding:0 0 8px 0;font-family:${EMAIL_FONT_STACK};font-size:20px;font-weight:600;line-height:28px;color:#18181b;">Booking confirmed</td></tr><tr><td style="padding:0 0 20px 0;font-family:${EMAIL_FONT_STACK};font-size:15px;line-height:24px;color:#3f3f46;">Hi ${escapeHtml(input.customerName)}, we have received your payment and reserved your consultation time.</td></tr><tr><td>${catalogBlock}</td></tr><tr><td>${reservationCard}</td></tr><tr><td>${calendarHtml}</td></tr><tr><td>${meetingSection}</td></tr><tr><td>${manageSection}</td></tr><tr><td>${paymentBlock}</td></tr><tr><td style="padding:24px 0 0 0;border-top:1px solid #e4e4e7;"><p style="margin:0;font-family:${EMAIL_FONT_STACK};font-size:12px;line-height:18px;color:#71717a;">This message was sent automatically by ${escapeHtml(TRANSACTIONAL_EMAIL_BRAND_NAME)}. If you did not make this booking, please contact support.</p></td></tr></table>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

function buildPaymentSectionHtml(transaction: PaymentTransactionRow): string {
  const rows: string[] = [
    buildEmailDetailRow('Amount', formatAmountPhp(transaction.amountCentavos)),
    buildEmailDetailRow('Gateway', resolveGatewayLabel(transaction.gatewayId)),
  ];
  const method = transaction.paymentMethodLabel?.trim() ?? '';
  if (method.length > 0) {
    rows.push(buildEmailDetailRow('Method', method));
  }
  const ref = transaction.providerRef.trim();
  if (ref.length > 0) {
    const displayRef = ref.length > 64 ? `${ref.slice(0, 64)}…` : ref;
    rows.push(buildEmailDetailRow('Reference', displayRef));
  }
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;"><tbody>${rows.join('')}</tbody></table>`;
}

function buildPaymentSectionPlainLines(transaction: PaymentTransactionRow): string[] {
  const lines: string[] = ['PAYMENT'];
  lines.push(`Amount: ${formatAmountPhp(transaction.amountCentavos)}`);
  lines.push(`Gateway: ${resolveGatewayLabel(transaction.gatewayId)}`);
  const method = transaction.paymentMethodLabel?.trim() ?? '';
  if (method.length > 0) {
    lines.push(`Method: ${method}`);
  }
  const ref = transaction.providerRef.trim();
  if (ref.length > 0) {
    lines.push(`Reference: ${ref.length > 64 ? `${ref.slice(0, 64)}…` : ref}`);
  }
  return lines;
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
  const siteOrigin = resolveAbsoluteSiteOrigin();
  const manageBookingEnabled = await readManageBookingEnabled();
  const manageUrl =
    manageBookingEnabled && siteOrigin.length > 0 ? `${siteOrigin}/book/manage` : '';
  const meetingUrl =
    booking.meetingUrl !== undefined && typeof booking.meetingUrl === 'string' && booking.meetingUrl.trim().length > 0
      ? booking.meetingUrl.trim()
      : null;
  const catalogRow = await getCatalogServiceByKey(booking.serviceKey);
  const serviceTitle = catalogRow?.title ?? formatServiceKeyLabel(booking.serviceKey);
  const paidAmountLabel =
    transaction !== null ? formatAmountPhp(transaction.amountCentavos) : (catalogRow?.amountLabel ?? null);
  const catalogDetails: BookingCatalogEmailDetails | null =
    catalogRow !== null
      ? {
          title: catalogRow.title,
          description: catalogRow.description,
          durationLabel: catalogRow.durationLabel,
          amountLabel: paidAmountLabel ?? catalogRow.amountLabel,
          kind: catalogRow.kind,
          sessionsIncluded: catalogRow.sessionsIncluded,
        }
      : null;
  const catalogSectionHtml = catalogDetails !== null ? buildCatalogServiceSectionHtml(catalogDetails) : null;
  const catalogPlainLines = catalogDetails !== null ? buildCatalogServicePlainLines(catalogDetails) : null;
  const paymentSectionHtml = transaction !== null ? buildPaymentSectionHtml(transaction) : null;
  const paymentPlainLines = transaction !== null ? buildPaymentSectionPlainLines(transaction) : null;
  const calendarBundle = buildBookingCalendarLinkBundle({
    title: `${serviceTitle} — ${bookingReference}`,
    description: `Booking reference ${bookingReference}. ${manageUrl.length > 0 ? `Manage: ${manageUrl}` : `Manage on ${TRANSACTIONAL_EMAIL_BRAND_NAME}.`}`,
    location: meetingUrl ?? '',
    startsAtUtc: startsAt,
    durationMinutes: BOOKING_SESSION_CALENDAR_DURATION_MINUTES,
    icsUidSeed: bookingReference,
  });
  const html = buildConfirmationHtml({
    customerName,
    bookingReference,
    serviceLabel: serviceTitle,
    dateLong,
    timeLabel,
    manageUrl,
    meetingUrl,
    siteOrigin,
    calendarBundle,
    catalogSectionHtml,
    paymentSectionHtml,
  });
  const text = buildConfirmationPlainText({
    customerName,
    bookingReference,
    serviceLabel: serviceTitle,
    dateLong,
    timeLabel,
    manageUrl,
    meetingUrl,
    calendarBundle,
    catalogPlainLines,
    paymentPlainLines,
  });
  const subject = `Booking confirmed — ${bookingReference}`;
  const basePayload: Record<string, unknown> = {
    bookingId: booking.id,
    transactionId: transaction?.id ?? null,
    bookingReference,
  };
  const outcome = await executeDispatchTransactionalEmail({ to, subject, html, text });
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

